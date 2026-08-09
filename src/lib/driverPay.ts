import { prisma } from "@/lib/prisma";
import { dailyDriverPay } from "@/lib/payroll";

export type DailyPayRow = { date: string; revenue: number; pay: number };

/** Each calendar day's total trip revenue (all a driver's trips that day,
 * summed), paired with what that day earned under the daily tariff — the
 * per-day breakdown behind computeDriverMonthlyPay's total. */
export async function getDailyPayBreakdown(driverId: string, from: Date, to: Date): Promise<DailyPayRow[]> {
  const trips = await prisma.trip.findMany({
    where: { driverId, tripDate: { gte: from, lte: to } },
    select: { tripDate: true, revenue: true },
  });

  const revenueByDay = new Map<string, number>();
  for (const t of trips) {
    const key = t.tripDate.toISOString().slice(0, 10);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(t.revenue));
  }

  return [...revenueByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue, pay: dailyDriverPay(revenue) }));
}

/**
 * A driver's pay for [from, to] under the daily-tariff system: each
 * calendar day's total trip revenue determines a flat rate for that day
 * (see dailyDriverPay). This *is* a driver's base salary now — it replaces
 * the flat, admin-set rate entirely, so a day with no trips (sick leave,
 * day off, vehicle handed to someone else) simply earns nothing rather
 * than needing separate proration.
 */
export async function computeDriverMonthlyPay(
  driverId: string,
  from: Date,
  to: Date
): Promise<{ total: bigint; dayCount: number }> {
  const rows = await getDailyPayBreakdown(driverId, from, to);
  const total = rows.reduce((s, r) => s + r.pay, 0);
  return { total: BigInt(total), dayCount: rows.length };
}
