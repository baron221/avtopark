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

/**
 * Picks whichever real reading is more recent — the last oil change (a
 * physical reading taken at service) or a standalone correction (see
 * UpdateOdometerForm, for when the GPS estimate has drifted but oil isn't
 * due yet) — as the baseline for estimateCurrentOdometerKm. Falls back to
 * the vehicle's creation-time reading when neither has ever happened.
 * Shared by the mechanic vehicle page and the Telegram /moy report so both
 * agree on the same current-km estimate.
 */
export function resolveOdometerBase(
  lastOilChange: { odometerKm: number; changedAt: Date } | null,
  vehicle: { odometerKm: number | null; odometerAsOf: Date | null; purchaseDate: Date }
): { km: number; date: Date } | null {
  const manualBase =
    vehicle.odometerKm != null ? { km: vehicle.odometerKm, date: vehicle.odometerAsOf ?? vehicle.purchaseDate } : null;

  if (lastOilChange && manualBase) {
    return lastOilChange.changedAt >= manualBase.date
      ? { km: lastOilChange.odometerKm, date: lastOilChange.changedAt }
      : manualBase;
  }
  return lastOilChange ? { km: lastOilChange.odometerKm, date: lastOilChange.changedAt } : manualBase;
}
