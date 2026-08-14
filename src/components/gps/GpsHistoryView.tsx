import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import { getWialonUnits, getWialonTrackForRange, matchVehiclesToWialonUnits } from "@/lib/wialon";
import { detectStationTransits, FARGONA_STATION, QUVA_STATION } from "@/lib/gpsTripDetection";
import { GpsTrackMapLoader } from "./GpsTrackMapLoader";
import { GpsVehicleSelect } from "./GpsVehicleSelect";

const DIRECTION_LABELS: Record<string, string> = {
  FARGONA_TO_QUVA: "Фарғона → Қува",
  QUVA_TO_FARGONA: "Қува → Фарғона",
};
const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

/**
 * Lets someone pick a vehicle + day and replay its GPS track on a map,
 * alongside the GPS-detected station transits and the dispatcher's own Trip
 * entries for that same day — for manually resolving a specific dispute
 * ("that day, where was this vehicle?"), rather than the aggregate 7-day
 * count comparison in GpsTripComparisonCard.
 */
export async function GpsHistoryView({
  basePath,
  vehicleId,
  dateStr,
}: {
  basePath: string;
  vehicleId?: string;
  dateStr: string;
}) {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { in: DISPATCHABLE_STATUSES } },
    select: { id: true, plate: true, driver: { select: { user: { select: { fullName: true } } } } },
    orderBy: { plate: "asc" },
  });

  if (vehicles.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-[13px] text-muted-2">Фаол машина йўқ</p>
      </Card>
    );
  }

  const selectedId = vehicleId && vehicles.some((v) => v.id === vehicleId) ? vehicleId : vehicles[0].id;
  const selectedVehicle = vehicles.find((v) => v.id === selectedId)!;

  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  let points: { t: Date; lat: number; lon: number }[] = [];
  let gpsError: string | null = null;
  try {
    const units = await getWialonUnits();
    const gpsMap = matchVehiclesToWialonUnits(vehicles, units);
    const unit = gpsMap.get(selectedId);
    if (unit) points = await getWialonTrackForRange(unit.id, dayStart, dayEnd);
  } catch (err) {
    console.error("Wialon GPS тарих хато:", err);
    gpsError = err instanceof Error ? err.message : String(err);
  }

  const transits = detectStationTransits(points);
  const trips = await prisma.trip.findMany({
    where: { vehicleId: selectedId, tripDate: { gte: dayStart, lt: dayEnd } },
    select: { departureTime: true, point: true, kind: true, tripNumber: true },
    orderBy: { departureTime: "asc" },
  });

  return (
    <Card className="overflow-hidden flex flex-col gap-0">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-row-divider">
        <div>
          <div className="font-heading font-bold text-base text-heading">Кун бўйича йўл тарихи</div>
          <div className="text-xs text-muted-2 font-semibold mt-0.5">
            Танланган машина ва куннинг GPS изи — низо чиққанда текшириш учун
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GpsVehicleSelect
            basePath={basePath}
            dateStr={dateStr}
            value={selectedId}
            vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver?.user.fullName ?? null }))}
          />
          <DatePicker basePath={basePath} value={dateStr} extraParams={{ vehicleId: selectedId }} />
        </div>
      </div>

      {gpsError && (
        <div className="mx-6 mt-4 bg-danger-tint text-danger text-[13px] font-bold px-4 py-3 rounded-xl">
          GPS серверига уланиб бўлмади: {gpsError}
        </div>
      )}

      <GpsTrackMapLoader
        points={points.map((p) => ({ t: p.t.toISOString(), lat: p.lat, lon: p.lon }))}
        stations={[
          { label: "Фарғона вокзали", lat: FARGONA_STATION.lat, lon: FARGONA_STATION.lon },
          { label: "Қува вокзали", lat: QUVA_STATION.lat, lon: QUVA_STATION.lon },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-row-divider border-t border-row-divider">
        <div className="p-5">
          <div className="text-xs font-extrabold text-muted-2 uppercase tracking-wide mb-3">
            GPS аниқлаган ({transits.length})
          </div>
          {transits.length === 0 ? (
            <p className="text-[13px] text-muted-2">Транзит топилмади</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {transits.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-heading">{DIRECTION_LABELS[t.direction]}</span>
                  <span className="text-muted-2 font-bold">
                    {t.detectedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-5">
          <div className="text-xs font-extrabold text-muted-2 uppercase tracking-wide mb-3">
            Диспетчер киритган ({trips.length})
          </div>
          {trips.length === 0 ? (
            <p className="text-[13px] text-muted-2">Рейс топилмади</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {trips.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-[13px] gap-2">
                  <span className="font-semibold text-heading">
                    {POINT_LABELS[t.point] ?? t.point}
                    {t.kind === "ORDER" && (
                      <span className="ml-1.5 bg-page border border-border text-muted-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full align-middle">
                        буюртма
                      </span>
                    )}
                  </span>
                  <span className="text-muted-2 font-bold whitespace-nowrap">
                    {t.departureTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
