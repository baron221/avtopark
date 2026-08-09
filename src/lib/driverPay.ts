import { prisma } from "@/lib/prisma";
import { dailyDriverPay } from "@/lib/payroll";

/**
 * A driver's pay for [from, to] under the daily-tariff system: each
 * calendar day's total trip revenue (all their trips that day, summed)
 * determines a flat rate for that day (see dailyDriverPay). This *is* a
 * driver's base salary now — it replaces the flat, admin-set rate entirely,
 * so a day with no trips (sick leave, day off, vehicle handed to someone
 * else) simply earns nothing rather than needing separate proration.
 */
export async function computeDriverMonthlyPay(
  driverId: string,
  from: Date,
  to: Date
): Promise<{ total: bigint; dayCount: number }> {
  const trips = await prisma.trip.findMany({
    where: { driverId, tripDate: { gte: from, lte: to } },
    select: { tripDate: true, revenue: true },
  });

  const revenueByDay = new Map<string, number>();
  for (const t of trips) {
    const key = t.tripDate.toISOString().slice(0, 10);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(t.revenue));
  }

  let total = 0;
  for (const dailyRevenue of revenueByDay.values()) {
    total += dailyDriverPay(dailyRevenue);
  }
  return { total: BigInt(total), dayCount: revenueByDay.size };
}
