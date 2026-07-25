import { prisma } from "@/lib/prisma";
import { uzMonthName, uzWeekdayShort } from "@/lib/format";
import type { VehicleType } from "@prisma/client";

export type Period = "DAY" | "WEEK" | "MONTH";

export type ExpenseBreakdownItem = { category: string; amount: number; pct: number };

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
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
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

async function computeTotals(from: Date, to: Date) {
  const [tripsAgg, plansAgg, expensesAgg, rentals] = await Promise.all([
    prisma.trip.aggregate({ _sum: { revenue: true }, where: { tripDate: { gte: from, lte: to } } }),
    prisma.dailyPlan.aggregate({ _sum: { paidAmount: true }, where: { planDate: { gte: from, lte: to } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: from, lte: to } } }),
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
  const totalExpense = Number(expensesAgg._sum.amount ?? BigInt(0));

  return { totalIncome, totalExpense };
}

export async function getOwnerDashboardVM(period: Period): Promise<OwnerDashboardVM> {
  const now = new Date();
  const { from, to } = rangeForPeriod(period, now);
  const prev = previousRange(period, { from, to });

  const [{ totalIncome, totalExpense }, prevTotals, vehicleCount, driverCount, expensesByCategory, dailyPlansToday, vehicles] =
    await Promise.all([
      computeTotals(from, to),
      computeTotals(prev.from, prev.to),
      prisma.vehicle.count(),
      prisma.driver.count(),
      prisma.expense.groupBy({
        by: ["category"],
        _sum: { amount: true },
        where: { expenseDate: { gte: from, lte: to } },
      }),
      prisma.dailyPlan.findMany({ where: { planDate: { gte: startOfDay(now), lte: endOfDay(now) } } }),
      prisma.vehicle.findMany({
        include: {
          driver: { include: { user: true } },
          trips: { where: { tripDate: { gte: from, lte: to } } },
          dailyPlans: { where: { planDate: { gte: from, lte: to } } },
          rentals: { where: { startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] } },
          expenses: { where: { expenseDate: { gte: from, lte: to } } },
        },
      }),
    ]);

  const netProfit = totalIncome - totalExpense;
  const prevNetProfit = prevTotals.totalIncome - prevTotals.totalExpense;
  const profitChangePct = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : null;

  const planToday = {
    paid: dailyPlansToday.filter((p) => Number(p.paidAmount) > 0).length,
    total: vehicleCount,
  };

  const categoryTotal = expensesByCategory.reduce((s, e) => s + Number(e._sum.amount ?? BigInt(0)), 0);
  const categoryLabels: Record<string, string> = {
    FUEL: "Yoqilg'i",
    REPAIR: "Ta'mirlash",
    SALARY: "Maosh",
    INSURANCE: "Sug'urta",
    TAX: "Soliq",
    TOLL: "Yo'l haqi",
    OTHER: "Boshqa",
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
    .sort((a, b) => b.amount - a.amount);

  const vehicleRows: VehicleProfitRow[] = vehicles.map((v) => {
    const tripIncome = v.trips.reduce((s, t) => s + Number(t.revenue), 0);
    const planIncome = v.dailyPlans.reduce((s, p) => s + Number(p.paidAmount), 0);
    const rentalIncome = v.rentals.reduce((s, r) => {
      const days = overlapDays(from, to, r.startDate, r.endDate);
      const month = daysInMonth(r.startDate.getFullYear(), r.startDate.getMonth());
      return s + (Number(r.monthlyAmount) * days) / month;
    }, 0);
    const expense = v.expenses.reduce((s, e) => s + Number(e.amount), 0);

    let incomeSource: VehicleProfitRow["incomeSource"] = "TRIPS";
    let driverName = v.driver?.user.fullName ?? "—";
    if (v.rentals.length > 0) {
      incomeSource = "RENTAL";
      driverName = `Ijara — ${v.rentals[0].renterName}`;
    } else if (v.dailyPlans.length > 0) {
      incomeSource = "PLAN";
    }

    const income = tripIncome + planIncome + rentalIncome;

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
      tripCount: v.trips.length,
    };
  });

  const chart = Array.from({ length: 7 }).map((_, i) => {
    const day = addDays(now, i - 6);
    return { label: uzWeekdayShort(day), day };
  });
  const chartWithTotals = await Promise.all(
    chart.map(async ({ label, day }) => {
      const { totalIncome: inc, totalExpense: exp } = await computeTotals(startOfDay(day), endOfDay(day));
      return { label, income: inc, expense: exp };
    })
  );

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
  };
}

export type MonthlyTrendPoint = { label: string; income: number; expense: number; profit: number };

export async function getMonthlyTrend(monthsBack = 6): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const months = Array.from({ length: monthsBack }).map((_, i) => {
    const offset = monthsBack - 1 - i;
    return new Date(now.getFullYear(), now.getMonth() - offset, 1);
  });

  return Promise.all(
    months.map(async (monthStart) => {
      const from = monthStart;
      const to = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
      const { totalIncome, totalExpense } = await computeTotals(from, to);
      return {
        label: uzMonthName(monthStart),
        income: totalIncome,
        expense: totalExpense,
        profit: totalIncome - totalExpense,
      };
    })
  );
}
