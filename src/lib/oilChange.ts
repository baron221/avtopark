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
/**
 * Same estimate as estimateCurrentOdometerKm + resolveOdometerBase, but for
 * every vehicle in the fleet at once (the mechanic's vehicle list) — three
 * bulk queries instead of N+1 per-vehicle round trips. Falls back the same
 * way the single-vehicle page does: GPS estimate, then the last known real
 * reading, then null (never had one).
 */
export async function estimateFleetOdometerKm(): Promise<Map<string, number | null>> {
  const [vehicles, oilChanges, mileages] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, odometerKm: true, odometerAsOf: true, purchaseDate: true } }),
    prisma.oilChange.findMany({
      orderBy: { changedAt: "desc" },
      select: { vehicleId: true, odometerKm: true, changedAt: true },
    }),
    prisma.vehicleMileage.findMany({ select: { vehicleId: true, date: true, km: true } }),
  ]);

  const lastOilChangeByVehicle = new Map<string, { odometerKm: number; changedAt: Date }>();
  for (const oc of oilChanges) {
    if (!lastOilChangeByVehicle.has(oc.vehicleId)) {
      lastOilChangeByVehicle.set(oc.vehicleId, { odometerKm: oc.odometerKm, changedAt: oc.changedAt });
    }
  }
  const mileagesByVehicle = new Map<string, { date: Date; km: number }[]>();
  for (const m of mileages) {
    const arr = mileagesByVehicle.get(m.vehicleId);
    if (arr) arr.push(m);
    else mileagesByVehicle.set(m.vehicleId, [m]);
  }

  const result = new Map<string, number | null>();
  for (const v of vehicles) {
    const base = resolveOdometerBase(lastOilChangeByVehicle.get(v.id) ?? null, v);
    if (!base) {
      result.set(v.id, null);
      continue;
    }
    const sinceBase = (mileagesByVehicle.get(v.id) ?? []).filter((m) => m.date > base.date);
    const estimated = sinceBase.length > 0 ? Math.round(base.km + sinceBase.reduce((s, m) => s + m.km, 0)) : null;
    result.set(v.id, estimated ?? v.odometerKm ?? base.km ?? null);
  }
  return result;
}

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
