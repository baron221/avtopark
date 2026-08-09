import { prisma } from "@/lib/prisma";
import { uzMonthName, uzWeekdayShort } from "@/lib/format";
import { monthStart as monthStartUTC } from "@/lib/month";
import type { VehicleType } from "@prisma/client";

export type Period = "DAY" | "WEEK" | "MONTH";

export type ExpenseBreakdownItem = { category: string; amount: number; pct: number };

export type PointBreakdownRow = {
  point: "FARGONA" | "QUVA";
  tripCount: number;
  tripIncome: number;
  orderCount: number;
  orderIncome: number;
  expenseCount: number;
  expenseTotal: number;
  expenseByCategory: { category: string; amount: number }[];
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
  const [trips, expenses, lunches, plans, rentals] = await Promise.all([
    prisma.trip.findMany({
      where: { tripDate: { gte: chartFrom, lte: chartTo } },
      select: { tripDate: true, revenue: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: chartFrom, lte: chartTo } },
      select: { expenseDate: true, amount: true },
    }),
    prisma.lunch.findMany({
      where: { lunchDate: { gte: chartFrom, lte: chartTo } },
      select: { lunchDate: true, amount: true },
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

async function computeTotals(from: Date, to: Date) {
  const [tripsAgg, plansAgg, expensesAgg, lunchAgg, rentals] = await Promise.all([
    prisma.trip.aggregate({ _sum: { revenue: true }, where: { tripDate: { gte: from, lte: to } } }),
    prisma.dailyPlan.aggregate({ _sum: { paidAmount: true }, where: { planDate: { gte: from, lte: to } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: from, lte: to } } }),
    // Lunch is a general company expense, not an individual payroll
    // deduction (see payroll.ts) — it still has to reduce fleet-wide profit.
    prisma.lunch.aggregate({ _sum: { amount: true }, where: { lunchDate: { gte: from, lte: to } } }),
    prisma.rental.findMany({ where: { startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] } }),
  ]);

  const tripIncome = Number(tripsAgg._sum.revenue ?? BigInt(0));
  const planIncome = Number(plansAgg._sum.paidAmount ?? BigInt(0));
  const rentalIncome = rentals.reduce((sum, r) => {
    const days = overlapDays(from, to, r.startDate, r.endDate);
    const month = daysInMonth(r.startDate.getFullYear(), r.startDate.getMonth());
    return sum + (Number(r.monthlyAmount) * days) / month;
  }, 0);

  const totalIncome = tripIncome + planIncome + rentalIncome;
  const totalExpense = Number(expensesAgg._sum.amount ?? BigInt(0)) + Number(lunchAgg._sum.amount ?? BigInt(0));

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
      select: { vehicleId: true, revenue: true, kind: true, point: true },
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
      select: { vehicleId: true, amount: true },
    }),
    computeDailyChart(chartFrom, chartTo, 7),
    // Point-scoped daily expenses (Стоянка/Обед/...) entered by dispatchers —
    // separate from Expense above, which is per-vehicle and not tied to a
    // point since the fleet is shared between both.
    prisma.staffExpense.findMany({
      where: { expenseDate: { gte: from, lte: to }, point: { in: ["FARGONA", "QUVA"] } },
      select: { point: true, category: true, amount: true },
    }),
  ]);

  const driverByVehicleId = new Map(driversFlat.filter((d) => d.vehicleId).map((d) => [d.vehicleId as string, d]));
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
  const categoryTotal =
    expensesByCategory.reduce((s, e) => s + Number(e._sum.amount ?? BigInt(0)), 0) + lunchExpenseTotal;
  const categoryLabels: Record<string, string> = {
    FUEL: "Ёқилғи",
    REPAIR: "Таъмирлаш",
    SALARY: "Маош",
    INSURANCE: "Суғурта",
    TAX: "Солиқ",
    TOLL: "Йўл ҳақи",
    OTHER: "Бошқа",
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

    const byCategory = new Map<string, number>();
    for (const e of pointExpenses) {
      const label = staffExpenseCategoryLabels[e.category] ?? e.category;
      byCategory.set(label, (byCategory.get(label) ?? 0) + Number(e.amount));
    }

    return {
      point,
      tripCount: trips.length,
      tripIncome: trips.reduce((s, t) => s + Number(t.revenue), 0),
      orderCount: orders.length,
      orderIncome: orders.reduce((s, t) => s + Number(t.revenue), 0),
      expenseCount: pointExpenses.length,
      expenseTotal: pointExpenses.reduce((s, e) => s + Number(e.amount), 0),
      expenseByCategory: Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  });

  return {
    period,
    periodLabel: uzMonthName(now),
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
