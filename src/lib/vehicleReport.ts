import { prisma } from "@/lib/prisma";
import { rangeForPeriod, daysInMonth, type Period } from "@/lib/dashboard";
import { monthStart as getMonthStart } from "@/lib/month";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";

export const PERIOD_LABELS: Record<Period, string> = { DAY: "Кунлик", WEEK: "Ҳафталик", MONTH: "Ойлик" };

const FUEL_TYPE_LABELS: Record<string, string> = { METAN: "Газ", BENZIN: "Бензин", DIZEL: "Дизель" };

export type VehicleReportLine = { label: string; amount: number };

export type VehicleReport = {
  plate: string;
  driverName: string | null;
  periodLabel: string;
  rangeLabel: string;
  tripCount: number;
  orderCount: number;
  expenseLines: VehicleReportLine[];
  totalExpense: number;
  income: number;
  profit: number;
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
}

export async function getVehicleReport(vehicleId: string, period: Period): Promise<VehicleReport | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { driver: { include: { user: true } } },
  });
  if (!vehicle) return null;

  const now = new Date();
  const { from, to } = rangeForPeriod(period, now);
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const monthStart = getMonthStart(now);
  const monthDays = daysInMonth(monthStart.getUTCFullYear(), monthStart.getUTCMonth());
  const proration = days / monthDays;

  const [trips, dailyPlans, fuelLogs, expenses, activeVehicleCount, driverSalary, staffSalaryAgg, staffExpenseAgg, lunchAgg] =
    await Promise.all([
      prisma.trip.findMany({ where: { vehicleId, tripDate: { gte: from, lte: to } }, select: { revenue: true, kind: true } }),
      prisma.dailyPlan.findMany({ where: { vehicleId, planDate: { gte: from, lte: to } }, select: { paidAmount: true } }),
      prisma.fuelLog.findMany({
        where: { vehicleId, filledAt: { gte: from, lte: to } },
        include: { station: { select: { fuelType: true } } },
      }),
      prisma.expense.findMany({ where: { vehicleId, expenseDate: { gte: from, lte: to } }, select: { category: true, amount: true } }),
      prisma.vehicle.count({ where: { status: { in: DISPATCHABLE_STATUSES } } }),
      vehicle.driver
        ? prisma.salary.findUnique({ where: { userId_month: { userId: vehicle.driver.userId, month: monthStart } } })
        : Promise.resolve(null),
      prisma.salary.aggregate({
        _sum: { netPay: true },
        where: { month: monthStart, user: { role: { notIn: ["DRIVER", "OWNER"] } } },
      }),
      prisma.staffExpense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: from, lte: to } } }),
      // Lunch is a general company expense now (not a payroll deduction),
      // so it belongs in the same shared-overhead pool as StaffExpense.
      prisma.lunch.aggregate({ _sum: { amount: true }, where: { lunchDate: { gte: from, lte: to } } }),
    ]);

  const income =
    trips.reduce((s, t) => s + Number(t.revenue), 0) + dailyPlans.reduce((s, p) => s + Number(p.paidAmount), 0);
  const tripCount = trips.filter((t) => t.kind === "TRIP").length;
  const orderCount = trips.filter((t) => t.kind === "ORDER").length;

  const fuelByTypeMap = new Map<string, number>();
  for (const log of fuelLogs) {
    const key = log.station.fuelType;
    fuelByTypeMap.set(key, (fuelByTypeMap.get(key) ?? 0) + Number(log.amount));
  }

  let fuelTotal = 0;
  let repairTotal = 0;
  let otherExpenseTotal = 0;
  for (const e of expenses) {
    const amount = Number(e.amount);
    if (e.category === "FUEL") fuelTotal += amount;
    else if (e.category === "REPAIR") repairTotal += amount;
    else otherExpenseTotal += amount;
  }

  const fuelByTypeSum = [...fuelByTypeMap.values()].reduce((s, v) => s + v, 0);
  const fuelResidual = fuelTotal - fuelByTypeSum;

  const driverSalaryAmount = driverSalary ? Number(driverSalary.netPay) * proration : 0;
  const overheadShare =
    activeVehicleCount > 0
      ? ((Number(staffSalaryAgg._sum.netPay ?? 0) * proration +
          Number(staffExpenseAgg._sum.amount ?? 0) +
          Number(lunchAgg._sum.amount ?? 0)) /
          activeVehicleCount)
      : 0;

  const expenseLines: VehicleReportLine[] = [];
  for (const [type, amount] of fuelByTypeMap) {
    expenseLines.push({ label: FUEL_TYPE_LABELS[type] ?? type, amount });
  }
  if (Math.abs(fuelResidual) >= 1) expenseLines.push({ label: "Бошқа ёқилғи", amount: fuelResidual });
  if (driverSalaryAmount > 0) expenseLines.push({ label: "Ҳайдовчи ойлиги", amount: Math.round(driverSalaryAmount) });
  if (repairTotal > 0) expenseLines.push({ label: "Таъмирлаш", amount: repairTotal });
  if (otherExpenseTotal > 0) expenseLines.push({ label: "Бошқа харажат", amount: otherExpenseTotal });
  if (overheadShare > 0) expenseLines.push({ label: "Умумий харажатлар улуши", amount: Math.round(overheadShare) });

  const totalExpense = expenseLines.reduce((s, l) => s + l.amount, 0);

  return {
    plate: vehicle.plate,
    driverName: vehicle.driver?.user.fullName ?? null,
    periodLabel: PERIOD_LABELS[period],
    rangeLabel: period === "DAY" ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`,
    tripCount,
    orderCount,
    expenseLines,
    totalExpense,
    income,
    profit: income - totalExpense,
  };
}
