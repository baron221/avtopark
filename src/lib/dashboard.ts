import { prisma } from "@/lib/prisma";
import { uzMonthName, uzWeekdayShort } from "@/lib/format";
import { monthStart as monthStartUTC } from "@/lib/month";
import { OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import type { VehicleType, OtherIncomePoint } from "@prisma/client";

export type Period = "DAY" | "WEEK" | "MONTH";

export type ExpenseBreakdownItem = { category: string; amount: number; pct: number };

export type PointBreakdownRow = {
  point: "FARGONA" | "QUVA";
  tripCount: number;
  tripIncome: number;
  orderCount: number;
  orderIncome: number;
  otherIncomeCount: number;
  otherIncome: number;
  expenseCount: number;
  expenseTotal: number;
  expenseByCategory: { category: string; amount: number }[];
};

export type PointVehicleRow = {
  vehicleId: string;
  plate: string;
  model: string;
  driverName: string;
  tripCount: number;
  orderCount: number;
  income: number;
  status: string;
};

export type OrderRow = {
  id: string;
  time: Date;
  point: "FARGONA" | "QUVA";
  plate: string;
  driverName: string;
  amount: number;
  note: string | null;
};

export type OtherIncomeRow = {
  id: string;
  time: Date;
  point: OtherIncomePoint;
  category: string;
  amount: number;
  plateNumber: string | null;
  note: string | null;
  enteredByName: string;
};

export type DailyBreakdownRow = {
  date: Date;
  quvaIncome: number;
  quvaExpense: number;
  fargonaIncome: number;
  fargonaExpense: number;
  totalIncome: number;
  totalExpense: number;
  advance: number;
  fine: number;
  outsideExpense: number;
};

export type VehicleProfitRow = {
  vehicleId: string;
  plate: string;
  model: string;
  type: VehicleType;
  driverName: string;
  incomeSource: "TRIPS" | "PLAN" | "RENTAL";
  income: number;
  expense: number;
  profit: number;
  status: string;
  tripCount: number;
  orderCount: number;
};

export type OwnerDashboardVM = {
  period: Period;
  periodLabel: string;
  vehicleCount: number;
  driverCount: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitChangePct: number | null;
  planToday: { paid: number; total: number };
  chart: { label: string; income: number; expense: number }[];
  expenseBreakdown: ExpenseBreakdownItem[];
  vehicles: VehicleProfitRow[];
  pointBreakdown: PointBreakdownRow[];
  pointVehicles: { point: "FARGONA" | "QUVA"; rows: PointVehicleRow[] }[];
  orders: OrderRow[];
  otherIncomes: OtherIncomeRow[];
  otherIncomeTotal: number;
  dailyBreakdown: DailyBreakdownRow[];
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// A DAY-period view was showing just "Avgust" everywhere (Чиқим/Тушум card
// titles etc.) with no indication of which day — the month alone was
// ambiguous once a specific date, not the whole month, was selected.
function periodLabel(period: Period, date: Date): string {
  if (period === "DAY") return `${date.getDate()}-${uzMonthName(date)}`;
  if (period === "WEEK") return "Сўнгги 7 кун";
  return uzMonthName(date);
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function rangeForPeriod(period: Period, now: Date) {
  const to = endOfDay(now);
  if (period === "DAY") return { from: startOfDay(now), to };
  if (period === "WEEK") return { from: startOfDay(addDays(now, -6)), to };
  return { from: monthStartUTC(now), to };
}

function previousRange(period: Period, current: { from: Date; to: Date }) {
  const lengthMs = current.to.getTime() - current.from.getTime();
  const to = new Date(current.from.getTime() - 1);
  const from = new Date(to.getTime() - lengthMs);
  return { from, to };
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function overlapDays(rangeFrom: Date, rangeTo: Date, start: Date, end: Date | null) {
  const effectiveEnd = end ?? rangeTo;
  const from = start > rangeFrom ? start : rangeFrom;
  const to = effectiveEnd < rangeTo ? effectiveEnd : rangeTo;
  if (to < from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function dayIndex(date: Date, rangeStart: Date) {
  return Math.round((startOfDay(date).getTime() - startOfDay(rangeStart).getTime()) / 86_400_000);
}

async function computeDailyChart(chartFrom: Date, chartTo: Date, days: number) {
  const [trips, otherIncomes, expenses, lunches, staffExpenses, plans, rentals] = await Promise.all([
    prisma.trip.findMany({
      where: { tripDate: { gte: chartFrom, lte: chartTo } },
      select: { tripDate: true, revenue: true },
    }),
    prisma.otherIncome.findMany({
      where: { incomeDate: { gte: chartFrom, lte: chartTo } },
      select: { incomeDate: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: chartFrom, lte: chartTo } },
      select: { expenseDate: true, amount: true },
    }),
    prisma.lunch.findMany({
      where: { lunchDate: { gte: chartFrom, lte: chartTo } },
      select: { lunchDate: true, amount: true },
    }),
    // Same gap as computeTotals above — see its comment.
    prisma.staffExpense.findMany({
      where: { expenseDate: { gte: chartFrom, lte: chartTo }, category: { not: "OBED" } },
      select: { expenseDate: true, amount: true },
    }),
    prisma.dailyPlan.findMany({
      where: { planDate: { gte: chartFrom, lte: chartTo } },
      select: { planDate: true, paidAmount: true },
    }),
    prisma.rental.findMany({
      where: { startDate: { lte: chartTo }, OR: [{ endDate: null }, { endDate: { gte: chartFrom } }] },
    }),
  ]);

  const income = new Array(days).fill(0);
  const expense = new Array(days).fill(0);

  for (const t of trips) {
    const i = dayIndex(t.tripDate, chartFrom);
    if (i >= 0 && i < days) income[i] += Number(t.revenue);
  }
  for (const oi of otherIncomes) {
    const i = dayIndex(oi.incomeDate, chartFrom);
    if (i >= 0 && i < days) income[i] += Number(oi.amount);
  }
  for (const p of plans) {
    const i = dayIndex(p.planDate, chartFrom);
    if (i >= 0 && i < days) income[i] += Number(p.paidAmount);
  }
  for (const e of expenses) {
    const i = dayIndex(e.expenseDate, chartFrom);
    if (i >= 0 && i < days) expense[i] += Number(e.amount);
  }
  for (const l of lunches) {
    const i = dayIndex(l.lunchDate, chartFrom);
    if (i >= 0 && i < days) expense[i] += Number(l.amount);
  }
  for (const e of staffExpenses) {
    const i = dayIndex(e.expenseDate, chartFrom);
    if (i >= 0 && i < days) expense[i] += Number(e.amount);
  }
  for (let i = 0; i < days; i++) {
    const day = addDays(chartFrom, i);
    for (const r of rentals) {
      const rentalEnd = r.endDate ?? chartTo;
      if (day >= startOfDay(r.startDate) && day <= endOfDay(rentalEnd)) {
        income[i] += Number(r.monthlyAmount) / daysInMonth(day.getFullYear(), day.getMonth());
      }
    }
  }

  return Array.from({ length: days }).map((_, i) => ({
    day: addDays(chartFrom, i),
    income: income[i],
    expense: expense[i],
  }));
}

// Accountant-only per-day ledger (see FleetDashboard's daily breakdown
// accordion) — reuses the same period-scoped flat arrays getOwnerDashboardVM
// already fetched for pointBreakdown/etc, so this adds no extra queries
// beyond advance/fine. Advance and Fine aren't point-scoped (they're tied to
// an employee, not FARGONA/QUVA), so they're shown as company-wide daily
// totals rather than split per point.
function computeDailyBreakdown(
  from: Date,
  days: number,
  trips: { point: "FARGONA" | "QUVA"; tripDate: Date; revenue: bigint | number }[],
  otherIncomes: { point: OtherIncomePoint; incomeDate: Date; amount: bigint | number }[],
  staffExpenses: { point: string; expenseDate: Date; amount: bigint | number }[],
  lunches: { point: "FARGONA" | "QUVA"; lunchDate: Date; amount: bigint | number }[],
  expenses: { expenseDate: Date; amount: bigint | number }[],
  advances: { givenDate: Date; amount: bigint | number }[],
  fines: { fineDate: Date; amount: bigint | number }[]
): DailyBreakdownRow[] {
  const rows: DailyBreakdownRow[] = Array.from({ length: days }).map((_, i) => ({
    date: addDays(from, i),
    quvaIncome: 0,
    quvaExpense: 0,
    fargonaIncome: 0,
    fargonaExpense: 0,
    totalIncome: 0,
    totalExpense: 0,
    advance: 0,
    fine: 0,
    outsideExpense: 0,
  }));

  for (const t of trips) {
    const i = dayIndex(t.tripDate, from);
    if (i < 0 || i >= days) continue;
    if (t.point === "QUVA") rows[i].quvaIncome += Number(t.revenue);
    else rows[i].fargonaIncome += Number(t.revenue);
  }
  for (const oi of otherIncomes) {
    const i = dayIndex(oi.incomeDate, from);
    if (i < 0 || i >= days) continue;
    // OtherIncomePoint also has BUXGALTERIYA (see IncomeEntryCard.tsx) —
    // neither Farg'ona nor Quva; folded into fargonaIncome would silently
    // misattribute it, so it's dropped from this per-point chart instead
    // (still counted in the real totals elsewhere — see computeTotals).
    if (oi.point === "QUVA") rows[i].quvaIncome += Number(oi.amount);
    else if (oi.point === "FARGONA") rows[i].fargonaIncome += Number(oi.amount);
  }
  for (const e of staffExpenses) {
    const i = dayIndex(e.expenseDate, from);
    if (i < 0 || i >= days) continue;
    // StaffExpensePoint also has YOLDA/ISHXONA (see AddExpenseForm.tsx) —
    // neither Farg'ona nor Quva, so they belong in outsideExpense; an
    // unconditional else here would wrongly dump them into Farg'ona.
    if (e.point === "QUVA") rows[i].quvaExpense += Number(e.amount);
    else if (e.point === "FARGONA") rows[i].fargonaExpense += Number(e.amount);
    else rows[i].outsideExpense += Number(e.amount);
  }
  for (const l of lunches) {
    const i = dayIndex(l.lunchDate, from);
    if (i < 0 || i >= days) continue;
    if (l.point === "QUVA") rows[i].quvaExpense += Number(l.amount);
    else rows[i].fargonaExpense += Number(l.amount);
  }
  for (const e of expenses) {
    const i = dayIndex(e.expenseDate, from);
    if (i >= 0 && i < days) rows[i].outsideExpense += Number(e.amount);
  }
  for (const a of advances) {
    const i = dayIndex(a.givenDate, from);
    if (i >= 0 && i < days) rows[i].advance += Number(a.amount);
  }
  for (const f of fines) {
    const i = dayIndex(f.fineDate, from);
    if (i >= 0 && i < days) rows[i].fine += Number(f.amount);
  }

  for (const r of rows) {
    r.totalIncome = r.quvaIncome + r.fargonaIncome;
    r.totalExpense = r.quvaExpense + r.fargonaExpense;
  }

  return rows.reverse();
}

async function computeTotals(from: Date, to: Date) {
  const [tripsAgg, otherIncomeAgg, plansAgg, expensesAgg, lunchAgg, staffExpenseAgg, rentals] = await Promise.all([
    prisma.trip.aggregate({ _sum: { revenue: true }, where: { tripDate: { gte: from, lte: to } } }),
    // Cash collected from non-fleet vehicles (tax/fuel/parking payments) —
    // real income, was missing from every total here, understating profit.
    prisma.otherIncome.aggregate({ _sum: { amount: true }, where: { incomeDate: { gte: from, lte: to } } }),
    prisma.dailyPlan.aggregate({ _sum: { paidAmount: true }, where: { planDate: { gte: from, lte: to } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: from, lte: to } } }),
    // Lunch is a general company expense, not an individual payroll
    // deduction (see payroll.ts) — it still has to reduce fleet-wide profit.
    prisma.lunch.aggregate({ _sum: { amount: true }, where: { lunchDate: { gte: from, lte: to } } }),
    // Point-scoped daily expenses (Стоянка/Шахсий озиқ-овқат/Бошқа расход)
    // dispatchers enter — real cash out, same as generic Expense/Lunch above,
    // but was missing from this total (it only ever fed the per-point cards,
    // see pointBreakdown below), which overstated netProfit by however much
    // of this a period had. OBED is excluded: the dispatcher form routes
    // "Обед" to the separate Lunch model instead (already counted above),
    // so summing both would double it.
    prisma.staffExpense.aggregate({
      _sum: { amount: true },
      where: { expenseDate: { gte: from, lte: to }, category: { not: "OBED" } },
    }),
    prisma.rental.findMany({ where: { startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] } }),
  ]);

  const tripIncome = Number(tripsAgg._sum.revenue ?? BigInt(0));
  const otherIncome = Number(otherIncomeAgg._sum.amount ?? BigInt(0));
  const planIncome = Number(plansAgg._sum.paidAmount ?? BigInt(0));
  const rentalIncome = rentals.reduce((sum, r) => {
    const days = overlapDays(from, to, r.startDate, r.endDate);
    const month = daysInMonth(r.startDate.getFullYear(), r.startDate.getMonth());
    return sum + (Number(r.monthlyAmount) * days) / month;
  }, 0);

  const totalIncome = tripIncome + otherIncome + planIncome + rentalIncome;
  const totalExpense =
    Number(expensesAgg._sum.amount ?? BigInt(0)) +
    Number(lunchAgg._sum.amount ?? BigInt(0)) +
    Number(staffExpenseAgg._sum.amount ?? BigInt(0));

  return { totalIncome, totalExpense };
}

export async function getOwnerDashboardVM(period: Period, referenceDate: Date = new Date()): Promise<OwnerDashboardVM> {
  const now = referenceDate;
  const { from, to } = rangeForPeriod(period, now);
  const prev = previousRange(period, { from, to });

  const chartFrom = startOfDay(addDays(now, -6));
  const chartTo = endOfDay(now);

  const [
    { totalIncome, totalExpense },
    prevTotals,
    vehicleCount,
    driverCount,
    expensesByCategory,
    lunchTotalAgg,
    dailyPlansToday,
    vehiclesFlat,
    driversFlat,
    tripsFlat,
    dailyPlansFlat,
    rentalsFlat,
    expensesFlat,
    dailyChart,
    staffExpensesFlat,
    lunchesFlat,
    otherIncomeFlat,
    advancesFlat,
    finesFlat,
  ] = await Promise.all([
    computeTotals(from, to),
    computeTotals(prev.from, prev.to),
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      where: { expenseDate: { gte: from, lte: to } },
    }),
    prisma.lunch.aggregate({ _sum: { amount: true }, where: { lunchDate: { gte: from, lte: to } } }),
    prisma.dailyPlan.findMany({ where: { planDate: { gte: startOfDay(now), lte: endOfDay(now) } } }),
    // Fetched flat (no nested `include`) and joined in JS below — a single
    // vehicle.findMany with 5 nested relations was measured at ~1.9s against
    // our high-latency DB region, vs ~200-700ms for these run concurrently.
    prisma.vehicle.findMany(),
    prisma.driver.findMany({ include: { user: true } }),
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to } },
      select: {
        id: true,
        vehicleId: true,
        driverId: true,
        revenue: true,
        kind: true,
        point: true,
        note: true,
        createdAt: true,
        tripDate: true,
      },
    }),
    prisma.dailyPlan.findMany({
      where: { planDate: { gte: from, lte: to } },
      select: { vehicleId: true, paidAmount: true },
    }),
    prisma.rental.findMany({
      where: { startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      select: { vehicleId: true, amount: true, expenseDate: true },
    }),
    computeDailyChart(chartFrom, chartTo, 7),
    // Point-scoped daily expenses (Стоянка/Обед/...) entered by dispatchers —
    // separate from Expense above, which is per-vehicle and not tied to a
    // point since the fleet is shared between both. Not filtered to
    // FARGONA/QUVA: the accountant's own "+ Бошқа расход" form can also
    // write YOLDA/ISHXONA rows (see AddExpenseForm.tsx) — pointBreakdown
    // below only reads FARGONA/QUVA out of this array so it's unaffected,
    // but computeDailyBreakdown needs the full set to route those into
    // outsideExpense instead of silently dropping them.
    prisma.staffExpense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      select: { point: true, category: true, amount: true, expenseDate: true },
    }),
    // Lunch is its own model (not a StaffExpense row, despite the dispatcher
    // form presenting "Обед" as one of the same category buttons — see
    // ExpenseForm.tsx), so pointBreakdown below needs it fetched separately
    // to show a point's true "Чиқим" count/total.
    prisma.lunch.findMany({
      where: { lunchDate: { gte: from, lte: to }, point: { in: ["FARGONA", "QUVA"] } },
      select: { point: true, amount: true, lunchDate: true },
    }),
    // Cash collected from non-fleet vehicles (see OtherIncome's schema
    // comment) — a real, point-attributed income source that was invisible
    // everywhere on this dashboard before (see computeTotals above).
    prisma.otherIncome.findMany({
      where: { incomeDate: { gte: from, lte: to } },
      include: { enteredByUser: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.advance.findMany({
      where: { givenDate: { gte: from, lte: to } },
      select: { givenDate: true, amount: true },
    }),
    prisma.fine.findMany({
      where: { fineDate: { gte: from, lte: to } },
      select: { fineDate: true, amount: true },
    }),
  ]);

  const driverByVehicleId = new Map(driversFlat.filter((d) => d.vehicleId).map((d) => [d.vehicleId as string, d]));
  // Vehicle -> its *current* driver, used for the per-vehicle summary rows
  // below (vehicleRows/pointVehicles) where showing "who drives it now" is a
  // reasonable label for a whole-period aggregate. A per-trip row (orderRows)
  // needs the driver who actually drove *that trip* instead — a vehicle
  // reassigned mid-period would otherwise show every one of its past trips
  // under the new driver's name, even ones from before they were ever
  // assigned to it.
  const driverById = new Map(driversFlat.map((d) => [d.id, d]));
  const vehicleById = new Map(vehiclesFlat.map((v) => [v.id, v]));
  // Kept separate (not just a combined trip+order count) so the fleet table
  // can show how much of a vehicle's activity is its regular route vs a
  // one-off private charter.
  const tripStatsByVehicle = new Map<string, { count: number; orderCount: number; income: number }>();
  for (const t of tripsFlat) {
    const entry = tripStatsByVehicle.get(t.vehicleId) ?? { count: 0, orderCount: 0, income: 0 };
    if (t.kind === "ORDER") entry.orderCount += 1;
    else entry.count += 1;
    entry.income += Number(t.revenue);
    tripStatsByVehicle.set(t.vehicleId, entry);
  }
  const planIncomeByVehicle = new Map<string, number>();
  const vehiclesWithPlan = new Set<string>();
  for (const p of dailyPlansFlat) {
    vehiclesWithPlan.add(p.vehicleId);
    planIncomeByVehicle.set(p.vehicleId, (planIncomeByVehicle.get(p.vehicleId) ?? 0) + Number(p.paidAmount));
  }
  const rentalsByVehicle = new Map<string, typeof rentalsFlat>();
  for (const r of rentalsFlat) {
    const arr = rentalsByVehicle.get(r.vehicleId) ?? [];
    arr.push(r);
    rentalsByVehicle.set(r.vehicleId, arr);
  }
  const expenseByVehicle = new Map<string, number>();
  for (const e of expensesFlat) {
    expenseByVehicle.set(e.vehicleId, (expenseByVehicle.get(e.vehicleId) ?? 0) + Number(e.amount));
  }

  const netProfit = totalIncome - totalExpense;
  const prevNetProfit = prevTotals.totalIncome - prevTotals.totalExpense;
  const profitChangePct = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : null;

  const planToday = {
    paid: dailyPlansToday.filter((p) => Number(p.paidAmount) > 0).length,
    total: vehicleCount,
  };

  const lunchExpenseTotal = Number(lunchTotalAgg._sum.amount ?? BigInt(0));
  // Same point-scoped dispatcher expenses as pointBreakdown above (OBED
  // excluded there too — see computeTotals's comment on why), grouped by
  // category for this breakdown specifically.
  const staffExpenseByCategory = new Map<string, number>();
  for (const e of staffExpensesFlat) {
    if (e.category === "OBED") continue;
    staffExpenseByCategory.set(e.category, (staffExpenseByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const staffExpenseTotal = [...staffExpenseByCategory.values()].reduce((s, v) => s + v, 0);
  const categoryTotal =
    expensesByCategory.reduce((s, e) => s + Number(e._sum.amount ?? BigInt(0)), 0) +
    lunchExpenseTotal +
    staffExpenseTotal;
  const categoryLabels: Record<string, string> = {
    FUEL: "Ёқилғи",
    REPAIR: "Таъмирлаш",
    SALARY: "Маош",
    INSURANCE: "Суғурта",
    TAX: "Солиқ",
    TOLL: "Йўл ҳақи",
    OTHER: "Бошқа",
  };
  const staffExpenseCategoryLabelsForBreakdown: Record<string, string> = {
    STOYANKA: "Стоянка",
    OZIQ_OVQAT: "Шахсий озиқ-овқат",
    BOSHQA: "Бошқа расход",
  };
  const expenseBreakdown: ExpenseBreakdownItem[] = expensesByCategory
    .map((e) => {
      const amount = Number(e._sum.amount ?? BigInt(0));
      return {
        category: categoryLabels[e.category] ?? e.category,
        amount,
        pct: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
      };
    })
    .concat(
      lunchExpenseTotal > 0
        ? [{ category: "Обед", amount: lunchExpenseTotal, pct: categoryTotal > 0 ? (lunchExpenseTotal / categoryTotal) * 100 : 0 }]
        : []
    )
    .concat(
      [...staffExpenseByCategory.entries()].map(([category, amount]) => ({
        category: staffExpenseCategoryLabelsForBreakdown[category] ?? category,
        amount,
        pct: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
      }))
    )
    .sort((a, b) => b.amount - a.amount);

  const vehicleRows: VehicleProfitRow[] = vehiclesFlat.map((v) => {
    const tripStats = tripStatsByVehicle.get(v.id) ?? { count: 0, orderCount: 0, income: 0 };
    const planIncome = planIncomeByVehicle.get(v.id) ?? 0;
    const vehicleRentals = rentalsByVehicle.get(v.id) ?? [];
    const rentalIncome = vehicleRentals.reduce((s, r) => {
      const days = overlapDays(from, to, r.startDate, r.endDate);
      const month = daysInMonth(r.startDate.getFullYear(), r.startDate.getMonth());
      return s + (Number(r.monthlyAmount) * days) / month;
    }, 0);
    const expense = expenseByVehicle.get(v.id) ?? 0;

    let incomeSource: VehicleProfitRow["incomeSource"] = "TRIPS";
    let driverName = driverByVehicleId.get(v.id)?.user.fullName ?? "—";
    if (vehicleRentals.length > 0) {
      incomeSource = "RENTAL";
      driverName = `Ijara — ${vehicleRentals[0].renterName}`;
    } else if (vehiclesWithPlan.has(v.id)) {
      incomeSource = "PLAN";
    }

    const income = tripStats.income + planIncome + rentalIncome;

    return {
      vehicleId: v.id,
      plate: v.plate,
      model: v.model,
      type: v.type,
      driverName,
      incomeSource,
      income,
      expense,
      profit: income - expense,
      status: v.status,
      tripCount: tripStats.count,
      orderCount: tripStats.orderCount,
    };
  });

  const chartWithTotals = dailyChart.map((d) => ({
    label: uzWeekdayShort(d.day),
    income: d.income,
    expense: d.expense,
  }));

  const staffExpenseCategoryLabels: Record<string, string> = {
    STOYANKA: "Стоянка",
    OZIQ_OVQAT: "Озиқ-овқат",
    OBED: "Обед",
    BOSHQA: "Бошқа",
  };
  const pointBreakdown: PointBreakdownRow[] = (["FARGONA", "QUVA"] as const).map((point) => {
    const pointTrips = tripsFlat.filter((t) => t.point === point);
    const trips = pointTrips.filter((t) => t.kind === "TRIP");
    const orders = pointTrips.filter((t) => t.kind === "ORDER");
    const pointExpenses = staffExpensesFlat.filter((e) => e.point === point);
    const pointLunches = lunchesFlat.filter((l) => l.point === point);
    const pointOtherIncome = otherIncomeFlat.filter((i) => i.point === point);

    const byCategory = new Map<string, number>();
    for (const e of pointExpenses) {
      const label = staffExpenseCategoryLabels[e.category] ?? e.category;
      byCategory.set(label, (byCategory.get(label) ?? 0) + Number(e.amount));
    }
    // Lunch is a separate model (see the query above), so it's merged in
    // here rather than already being part of pointExpenses.
    const pointLunchTotal = pointLunches.reduce((s, l) => s + Number(l.amount), 0);
    if (pointLunchTotal > 0) byCategory.set("Обед", (byCategory.get("Обед") ?? 0) + pointLunchTotal);

    return {
      point,
      tripCount: trips.length,
      tripIncome: trips.reduce((s, t) => s + Number(t.revenue), 0),
      orderCount: orders.length,
      orderIncome: orders.reduce((s, t) => s + Number(t.revenue), 0),
      otherIncomeCount: pointOtherIncome.length,
      otherIncome: pointOtherIncome.reduce((s, i) => s + Number(i.amount), 0),
      expenseCount: pointExpenses.length + pointLunches.length,
      expenseTotal: pointExpenses.reduce((s, e) => s + Number(e.amount), 0) + pointLunchTotal,
      expenseByCategory: Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  });

  // Per-vehicle income at each point specifically (via Trip.point) — unlike
  // vehicleRows' expense/profit above, a vehicle's repair/fuel cost isn't
  // tied to a point (the fleet is shared), so there's no correct way to
  // split it per point; this breakdown is income-only for that reason.
  const pointVehicles = (["FARGONA", "QUVA"] as const).map((point) => {
    const byVehicle = new Map<string, { tripCount: number; orderCount: number; income: number }>();
    for (const t of tripsFlat) {
      if (t.point !== point) continue;
      const entry = byVehicle.get(t.vehicleId) ?? { tripCount: 0, orderCount: 0, income: 0 };
      if (t.kind === "ORDER") entry.orderCount += 1;
      else entry.tripCount += 1;
      entry.income += Number(t.revenue);
      byVehicle.set(t.vehicleId, entry);
    }
    const rows: PointVehicleRow[] = Array.from(byVehicle.entries())
      .map(([vehicleId, stats]) => {
        const v = vehicleById.get(vehicleId);
        return {
          vehicleId,
          plate: v?.plate ?? "—",
          model: v?.model ?? "—",
          driverName: driverByVehicleId.get(vehicleId)?.user.fullName ?? "—",
          tripCount: stats.tripCount,
          orderCount: stats.orderCount,
          income: stats.income,
          status: v?.status ?? "—",
        };
      })
      .sort((a, b) => b.income - a.income);
    return { point, rows };
  });

  const orderRows: OrderRow[] = tripsFlat
    .filter((t) => t.kind === "ORDER")
    .map((t) => ({
      id: t.id,
      time: t.createdAt,
      point: t.point,
      plate: vehicleById.get(t.vehicleId)?.plate ?? "—",
      driverName: driverById.get(t.driverId)?.user.fullName ?? "—",
      amount: Number(t.revenue),
      note: t.note,
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  const otherIncomeRows: OtherIncomeRow[] = otherIncomeFlat.map((i) => ({
    id: i.id,
    time: i.createdAt,
    point: i.point,
    category: OTHER_INCOME_CATEGORY_LABELS[i.category] ?? i.category,
    amount: Number(i.amount),
    plateNumber: i.plateNumber,
    note: i.note,
    enteredByName: i.enteredByUser.fullName,
  }));
  const otherIncomeTotal = otherIncomeRows.reduce((s, i) => s + i.amount, 0);

  const periodDays = overlapDays(from, to, from, to);
  const dailyBreakdown = computeDailyBreakdown(
    from,
    periodDays,
    tripsFlat,
    otherIncomeFlat,
    staffExpensesFlat,
    lunchesFlat,
    expensesFlat,
    advancesFlat,
    finesFlat
  );

  return {
    period,
    periodLabel: periodLabel(period, now),
    vehicleCount,
    driverCount,
    totalIncome,
    totalExpense,
    netProfit,
    profitChangePct,
    planToday,
    chart: chartWithTotals,
    expenseBreakdown,
    vehicles: vehicleRows,
    pointBreakdown,
    pointVehicles,
    orders: orderRows,
    otherIncomes: otherIncomeRows,
    otherIncomeTotal,
    dailyBreakdown,
  };
}

export type MonthlyTrendPoint = { label: string; income: number; expense: number; profit: number };

export async function getMonthlyTrend(monthsBack = 6): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const currentMonthStart = monthStartUTC(now);
  const rangeFrom = new Date(
    Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - (monthsBack - 1), 1)
  );
  const rangeTo = endOfDay(now);

  const monthIndex = (date: Date) =>
    (date.getUTCFullYear() - rangeFrom.getUTCFullYear()) * 12 + (date.getUTCMonth() - rangeFrom.getUTCMonth());

  const [trips, expenses, plans, rentals] = await Promise.all([
    prisma.trip.findMany({ where: { tripDate: { gte: rangeFrom, lte: rangeTo } }, select: { tripDate: true, revenue: true } }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: rangeFrom, lte: rangeTo } },
      select: { expenseDate: true, amount: true },
    }),
    prisma.dailyPlan.findMany({
      where: { planDate: { gte: rangeFrom, lte: rangeTo } },
      select: { planDate: true, paidAmount: true },
    }),
    prisma.rental.findMany({
      where: { startDate: { lte: rangeTo }, OR: [{ endDate: null }, { endDate: { gte: rangeFrom } }] },
    }),
  ]);

  const income = new Array(monthsBack).fill(0);
  const expense = new Array(monthsBack).fill(0);

  for (const t of trips) {
    const i = monthIndex(t.tripDate);
    if (i >= 0 && i < monthsBack) income[i] += Number(t.revenue);
  }
  for (const p of plans) {
    const i = monthIndex(p.planDate);
    if (i >= 0 && i < monthsBack) income[i] += Number(p.paidAmount);
  }
  for (const e of expenses) {
    const i = monthIndex(e.expenseDate);
    if (i >= 0 && i < monthsBack) expense[i] += Number(e.amount);
  }

  for (let i = 0; i < monthsBack; i++) {
    const mStart = new Date(Date.UTC(rangeFrom.getUTCFullYear(), rangeFrom.getUTCMonth() + i, 1));
    const mEnd = new Date(Date.UTC(rangeFrom.getUTCFullYear(), rangeFrom.getUTCMonth() + i + 1, 0, 23, 59, 59, 999));
    for (const r of rentals) {
      const days = overlapDays(mStart, mEnd, r.startDate, r.endDate);
      if (days > 0) {
        income[i] += (Number(r.monthlyAmount) * days) / daysInMonth(mStart.getUTCFullYear(), mStart.getUTCMonth());
      }
    }
  }

  return Array.from({ length: monthsBack }).map((_, i) => {
    const mStart = new Date(Date.UTC(rangeFrom.getUTCFullYear(), rangeFrom.getUTCMonth() + i, 1));
    return {
      label: uzMonthName(mStart),
      income: income[i],
      expense: expense[i],
      profit: income[i] - expense[i],
    };
  });
}
