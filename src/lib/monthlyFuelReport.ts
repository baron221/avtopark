import { prisma } from "@/lib/prisma";
import { getWialonMileageForRange } from "@/lib/wialon";

export type MonthlyFuelTypeRow = { fuelType: string; volume: number; ratePer100: number | null };
export type MonthlyFuelReport = { km: number; kmIsLive: boolean; byType: MonthlyFuelTypeRow[] };

/**
 * One vehicle's fuel-by-type volumes for [from, to] against GPS-tracked
 * distance for the same range — lets a mechanic enter each day's metan/
 * benzin fill-ups (see FuelLogForm's date field) and see exactly how far
 * that fuel took the vehicle and what it cost per 100km.
 *
 * Distance prefers the daily VehicleMileage snapshots (fast, DB-only) but
 * falls back to one live Wialon range query when the range predates the
 * daily-mileage cron or otherwise has gaps — slower (a full month can take
 * ~10s against the self-hosted server) but Wialon retains history
 * regardless of when our own cron started recording it.
 */
export async function getVehicleMonthlyFuelReport(
  vehicleId: string,
  unitId: number,
  from: Date,
  to: Date
): Promise<MonthlyFuelReport> {
  const daysInRange = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;

  const [fuelLogs, mileageRows] = await Promise.all([
    prisma.fuelLog.findMany({
      where: { vehicleId, filledAt: { gte: from, lte: to } },
      include: { station: { select: { fuelType: true } } },
    }),
    prisma.vehicleMileage.findMany({ where: { vehicleId, date: { gte: from, lte: to } } }),
  ]);

  let km: number;
  let kmIsLive = false;
  if (mileageRows.length >= daysInRange - 2) {
    km = mileageRows.reduce((s, m) => s + m.km, 0);
  } else {
    km = await getWialonMileageForRange(unitId, from, to, 150_000);
    kmIsLive = true;
  }

  const volumeByType = new Map<string, number>();
  for (const log of fuelLogs) {
    volumeByType.set(log.station.fuelType, (volumeByType.get(log.station.fuelType) ?? 0) + Number(log.volume));
  }

  const byType: MonthlyFuelTypeRow[] = Array.from(volumeByType.entries())
    .map(([fuelType, volume]) => ({
      fuelType,
      volume,
      ratePer100: km > 0 ? (volume / km) * 100 : null,
    }))
    .sort((a, b) => b.volume - a.volume);

  return { km, kmIsLive, byType };
}
