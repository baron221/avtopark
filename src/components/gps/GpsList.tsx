import { Card } from "@/components/ui/Card";
import type { WialonUnit } from "@/lib/wialon";
import { GpsMapLoader } from "./GpsMapLoader";

type VehicleRow = { id: string; plate: string; driver: { user: { fullName: string } } | null };

// A working vehicle should ping every few seconds while the ignition is on —
// if we haven't heard from it in this long, the device is very likely
// offline (powered down, no SIM signal, unplugged) rather than just idling.
const STALE_HOURS = 3;
// A vehicle stopped for longer than this (but still reporting) is treated as
// parked rather than just paused in traffic/at a stop.
const PARKED_AFTER_MINUTES = 15;

function formatAgo(d: Date, now: Date) {
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "ҳозир";
  if (mins < 60) return `${mins} дақиқа олдин`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} соат олдин`;
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
}

function vehicleStatus(unit: WialonUnit, now: Date): { label: string; className: string } {
  if (unit.speedKmh > 0) return { label: "Ҳаракатда", className: "bg-success-tint text-success" };
  const mins = (now.getTime() - unit.lastUpdate.getTime()) / 60000;
  if (mins < PARKED_AFTER_MINUTES) return { label: "Тўхтаган", className: "bg-warning-tint text-warning" };
  return { label: "Паркда", className: "bg-page border border-border text-muted-2" };
}

export function GpsList({
  vehicles,
  gpsMap,
  todayStats,
  gpsError,
}: {
  vehicles: VehicleRow[];
  gpsMap: Map<string, WialonUnit>;
  todayStats: Map<string, { kmToday: number; maxSpeedKmh: number }>;
  gpsError: string | null;
}) {
  const now = new Date();

  const mapPoints = vehicles
    .map((v) => {
      const unit = gpsMap.get(v.id);
      if (!unit) return null;
      return {
        id: v.id,
        plate: v.plate,
        driverName: v.driver?.user.fullName ?? "—",
        lat: unit.lat,
        lon: unit.lon,
        speedKmh: unit.speedKmh,
        lastUpdateLabel: formatAgo(unit.lastUpdate, now),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <>
      {gpsError && (
        <div className="bg-danger-tint text-danger text-[13px] font-bold px-4 py-3 rounded-xl">
          GPS серверига уланиб бўлмади: {gpsError}
        </div>
      )}

      <Card className="overflow-hidden">
        <GpsMapLoader points={mapPoints} />
      </Card>

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="grid grid-cols-[1fr_1.3fr_0.9fr_1.1fr_1fr_0.9fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Машина</div>
          <div>Ҳайдовчи</div>
          <div>Макс. тезлик (бугун)</div>
          <div>Сўнгги алоқа</div>
          <div>Ҳолат</div>
          <div></div>
        </div>
        {vehicles.map((v) => {
          const unit = gpsMap.get(v.id);
          const isStale = unit ? now.getTime() - unit.lastUpdate.getTime() > STALE_HOURS * 3_600_000 : false;
          const stats = todayStats.get(v.id);
          const status = unit ? vehicleStatus(unit, now) : null;
          return (
            <div
              key={v.id}
              className="grid grid-cols-[1fr_1.3fr_0.9fr_1.1fr_1fr_0.9fr] gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="font-extrabold text-primary font-heading">{v.plate}</div>
              <div className="font-semibold text-heading">{v.driver?.user.fullName ?? "—"}</div>
              {unit ? (
                <>
                  <div className={`font-bold ${stats && stats.maxSpeedKmh > 0 ? "text-success" : "text-muted-2"}`}>
                    {stats && stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh} км/соат` : "—"}
                  </div>
                  <div>
                    {isStale ? (
                      <span className="bg-danger-tint text-danger text-xs font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap">
                        ⚠ Сигнал йўқ · {formatAgo(unit.lastUpdate, now)}
                      </span>
                    ) : (
                      <span className="text-muted-2 font-semibold text-xs">{formatAgo(unit.lastUpdate, now)}</span>
                    )}
                    {stats && (
                      <div className="text-muted-2 text-xs font-semibold mt-0.5">
                        {Math.round(stats.kmToday)} км (бугун)
                      </div>
                    )}
                  </div>
                  <div>
                    {status && (
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap ${status.className}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${unit.lat},${unit.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-extrabold text-xs hover:underline"
                  >
                    Харитада ↗
                  </a>
                </>
              ) : (
                <div className="text-xs text-muted-2 font-semibold col-span-4">GPS уланмаган</div>
              )}
            </div>
          );
        })}
        {vehicles.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Фаол машина йўқ</p>}
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {vehicles.map((v) => {
          const unit = gpsMap.get(v.id);
          const isStale = unit ? now.getTime() - unit.lastUpdate.getTime() > STALE_HOURS * 3_600_000 : false;
          const stats = todayStats.get(v.id);
          const status = unit ? vehicleStatus(unit, now) : null;
          return (
            <Card key={v.id} className="p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-extrabold text-primary font-heading">{v.plate}</div>
                  <div className="text-xs text-heading font-semibold mt-0.5">{v.driver?.user.fullName ?? "—"}</div>
                </div>
                {unit && (
                  <a
                    href={`https://www.google.com/maps?q=${unit.lat},${unit.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-extrabold text-xs hover:underline shrink-0"
                  >
                    Харитада ↗
                  </a>
                )}
              </div>
              {unit ? (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-row-divider">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        stats && stats.maxSpeedKmh > 0 ? "bg-success-tint text-success" : "bg-page border border-border text-muted-2"
                      }`}
                    >
                      {stats && stats.maxSpeedKmh > 0 ? `Макс. ${stats.maxSpeedKmh} км/соат` : "Макс. тезлик —"}
                    </span>
                    {status && (
                      <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isStale ? (
                      <span className="bg-danger-tint text-danger text-xs font-extrabold px-2 py-0.5 rounded-full">
                        ⚠ Сигнал йўқ · {formatAgo(unit.lastUpdate, now)}
                      </span>
                    ) : (
                      <span className="text-muted-2 font-semibold text-xs">{formatAgo(unit.lastUpdate, now)}</span>
                    )}
                    {stats && (
                      <span className="text-muted-2 font-semibold text-xs">· {Math.round(stats.kmToday)} км (бугун)</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-2 font-semibold pt-1 border-t border-row-divider">
                  GPS уланмаган
                </div>
              )}
            </Card>
          );
        })}
        {vehicles.length === 0 && (
          <Card className="p-4">
            <p className="text-[13px] text-muted-2">Фаол машина йўқ</p>
          </Card>
        )}
      </div>
    </>
  );
}
