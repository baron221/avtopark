import { prisma } from "@/lib/prisma";

/**
 * Estimates a vehicle's current odometer by adding GPS-tracked daily
 * mileage (VehicleMileage, from the Wialon daily-mileage cron) since the
 * last known real reading. A suggestion for the mechanic to confirm, not a
 * replacement for the physical odometer — it's a haversine-distance
 * estimate, not the literal reading. Returns null when there's no GPS
 * mileage data since that date (nothing to add, not "no change").
 */
export async function estimateCurrentOdometerKm(
  vehicleId: string,
  baseOdometerKm: number,
  baseDate: Date
): Promise<number | null> {
  const agg = await prisma.vehicleMileage.aggregate({
    _sum: { km: true },
    where: { vehicleId, date: { gt: baseDate } },
  });
  if (agg._sum.km == null) return null;
  return Math.round(baseOdometerKm + agg._sum.km);
}
