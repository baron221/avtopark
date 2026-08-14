import { prisma } from "@/lib/prisma";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";

export type GpsTripComparisonDay = {
  date: Date;
  gpsCount: number;
  dispatcherCount: number;
  // True when the vehicle had a private-charter Order that day — it then
  // legitimately drives off the Farg'ona<->Quva route for part of the day,
  // so a GPS/dispatcher mismatch on this day isn't a real discrepancy and
  // shouldn't count toward the row's totals/flagging.
  hasOrder: boolean;
};

export type GpsTripComparisonRow = {
  vehicleId: string;
  plate: string;
  driverName: string | null;
  totalGps: number;
  totalDispatcher: number;
  days: GpsTripComparisonDay[];
};

const COMPARISON_DAYS = 7;

/**
 * Compares GPS-detected station-to-station transits (gpsTripDetection.ts,
 * populated daily by the /api/gps/daily-trips cron) against dispatcher-
 * entered Trip records (kind=TRIP only — ORDER is a one-off private charter,
 * not the fixed vokzal-to-vokzal shuttle route this compares), per vehicle
 * per day. Purely a discrepancy signal — never used to create/modify Trip
 * rows, only to flag when the two sources disagree so someone can look into
 * why. Days with an Order are excluded from the totals a mismatch is judged
 * against (see hasOrder above).
 *
 * @param uptoDateStr ISO yyyy-mm-dd — when given, narrows to that single day
 * (the GPS history page's selected date). Omitted, it defaults to the last
 * COMPARISON_DAYS days ending "yesterday": today itself is excluded because
 * the daily cron only detects the *previous* day's transits, so today would
 * otherwise show as 100% GPS-missing noise.
 */
export async function getGpsTripComparisonRows(uptoDateStr?: string): Promise<GpsTripComparisonRow[]> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = uptoDateStr ? new Date(new Date(`${uptoDateStr}T00:00:00Z`).getTime() + 86_400_000) : todayStart;
  const windowDays = uptoDateStr ? 1 : COMPARISON_DAYS;
  const rangeStart = new Date(windowEnd.getTime() - windowDays * 86_400_000);

  const vehicles = await prisma.vehicle.findMany({
    where: { status: { in: DISPATCHABLE_STATUSES } },
    select: { id: true, plate: true, driver: { select: { user: { select: { fullName: true } } } } },
    orderBy: { plate: "asc" },
  });
  const vehicleIds = vehicles.map((v) => v.id);

  const [gpsTransits, trips, orders] = await Promise.all([
    prisma.gpsDetectedTrip.findMany({
      where: { vehicleId: { in: vehicleIds }, detectedAt: { gte: rangeStart } },
      select: { vehicleId: true, detectedAt: true },
    }),
    prisma.trip.findMany({
      where: { vehicleId: { in: vehicleIds }, kind: "TRIP", tripDate: { gte: rangeStart } },
      select: { vehicleId: true, tripDate: true },
    }),
    prisma.trip.findMany({
      where: { vehicleId: { in: vehicleIds }, kind: "ORDER", tripDate: { gte: rangeStart } },
      select: { vehicleId: true, tripDate: true },
    }),
  ]);

  function dayKey(vehicleId: string, date: Date) {
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return `${vehicleId}|${day}`;
  }

  const gpsCounts = new Map<string, number>();
  for (const t of gpsTransits) {
    const key = dayKey(t.vehicleId, t.detectedAt);
    gpsCounts.set(key, (gpsCounts.get(key) ?? 0) + 1);
  }
  const dispatcherCounts = new Map<string, number>();
  for (const t of trips) {
    const key = dayKey(t.vehicleId, t.tripDate);
    dispatcherCounts.set(key, (dispatcherCounts.get(key) ?? 0) + 1);
  }
  const orderDayKeys = new Set(orders.map((o) => dayKey(o.vehicleId, o.tripDate)));

  const dayList: Date[] = [];
  for (let i = windowDays; i >= 1; i--) {
    dayList.push(new Date(windowEnd.getTime() - i * 86_400_000));
  }

  return vehicles
    .map((v) => {
      const days = dayList.map((date) => {
        const key = dayKey(v.id, date);
        return {
          date,
          gpsCount: gpsCounts.get(key) ?? 0,
          dispatcherCount: dispatcherCounts.get(key) ?? 0,
          hasOrder: orderDayKeys.has(key),
        };
      });
      const comparableDays = days.filter((d) => !d.hasOrder);
      return {
        vehicleId: v.id,
        plate: v.plate,
        driverName: v.driver?.user.fullName ?? null,
        totalGps: comparableDays.reduce((s, d) => s + d.gpsCount, 0),
        totalDispatcher: comparableDays.reduce((s, d) => s + d.dispatcherCount, 0),
        days,
      };
    })
    .filter((row) => row.totalGps > 0 || row.totalDispatcher > 0);
}
