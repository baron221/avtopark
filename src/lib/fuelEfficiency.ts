import { prisma } from "@/lib/prisma";
import { monthStart, monthEnd } from "@/lib/month";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";

export type FuelEfficiencyRow = {
  vehicleId: string;
  plate: string;
  driverName: string;
  fuelType: string;
  volume: number;
  km: number;
  ratePer100: number | null;
  fleetAvgRatePer100: number | null;
  isAnomalous: boolean;
};

// Vehicles under this monthly distance are excluded from the fleet-average
// calculation and never flagged — too little driving makes the ratio noisy
// (e.g. one short trip on a nearly-full tank looks like terrible mileage).
const MIN_KM_FOR_COMPARISON = 20;
const ANOMALY_THRESHOLD = 1.25;

/**
 * Compares each vehicle's this-month fuel volume against distance driven
 * (from the daily VehicleMileage snapshots), flagging any vehicle burning
 * noticeably more fuel per km than its fuel-type's fleet average — a cheap
 * signal for leaks, theft, or a badly tuned engine.
 */
export async function getFuelEfficiencyRows(): Promise<FuelEfficiencyRow[]> {
  const now = new Date();
  const from = monthStart(now);
  const to = monthEnd(now);

  const [vehicles, fuelLogs, mileages] = await Promise.all([
    prisma.vehicle.findMany({
      where: { status: { in: DISPATCHABLE_STATUSES } },
      include: { driver: { include: { user: true } } },
    }),
    prisma.fuelLog.findMany({
      where: { filledAt: { gte: from, lte: to } },
      include: { station: { select: { fuelType: true } } },
    }),
    prisma.vehicleMileage.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);

  const volumeByVehicleType = new Map<string, Map<string, number>>();
  for (const log of fuelLogs) {
    const byType = volumeByVehicleType.get(log.vehicleId) ?? new Map<string, number>();
    byType.set(log.station.fuelType, (byType.get(log.station.fuelType) ?? 0) + Number(log.volume));
    volumeByVehicleType.set(log.vehicleId, byType);
  }

  const kmByVehicle = new Map<string, number>();
  for (const m of mileages) {
    kmByVehicle.set(m.vehicleId, (kmByVehicle.get(m.vehicleId) ?? 0) + m.km);
  }

  type Base = { vehicleId: string; plate: string; driverName: string; fuelType: string; volume: number; km: number };
  const base: Base[] = [];
  for (const v of vehicles) {
    const byType = volumeByVehicleType.get(v.id);
    if (!byType || byType.size === 0) continue;
    let fuelType = "";
    let volume = -1;
    for (const [type, vol] of byType) {
      if (vol > volume) {
        volume = vol;
        fuelType = type;
      }
    }
    base.push({
      vehicleId: v.id,
      plate: v.plate,
      driverName: v.driver?.user.fullName ?? "—",
      fuelType,
      volume,
      km: kmByVehicle.get(v.id) ?? 0,
    });
  }

  const groupsByType = new Map<string, Base[]>();
  for (const r of base) {
    const arr = groupsByType.get(r.fuelType) ?? [];
    arr.push(r);
    groupsByType.set(r.fuelType, arr);
  }
  const fleetAvgByType = new Map<string, number>();
  for (const [type, group] of groupsByType) {
    const comparable = group.filter((r) => r.km >= MIN_KM_FOR_COMPARISON);
    const totalVolume = comparable.reduce((s, r) => s + r.volume, 0);
    const totalKm = comparable.reduce((s, r) => s + r.km, 0);
    if (totalKm > 0) fleetAvgByType.set(type, (totalVolume / totalKm) * 100);
  }

  return base
    .map((r) => {
      const ratePer100 = r.km > 0 ? (r.volume / r.km) * 100 : null;
      const fleetAvgRatePer100 = fleetAvgByType.get(r.fuelType) ?? null;
      const isAnomalous =
        ratePer100 !== null &&
        fleetAvgRatePer100 !== null &&
        r.km >= MIN_KM_FOR_COMPARISON &&
        ratePer100 > fleetAvgRatePer100 * ANOMALY_THRESHOLD;
      return { ...r, ratePer100, fleetAvgRatePer100, isAnomalous };
    })
    .sort((a, b) => (b.ratePer100 ?? 0) - (a.ratePer100 ?? 0));
}
