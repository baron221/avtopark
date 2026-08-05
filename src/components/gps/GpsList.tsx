import { Card } from "@/components/ui/Card";
import type { WialonUnit } from "@/lib/wialon";

type VehicleRow = { id: string; plate: string; driver: { user: { fullName: string } } | null };

function formatAgo(d: Date, now: Date) {
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "ҳозир";
  if (mins < 60) return `${mins} дақиқа олдин`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} соат олдин`;
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
}

export function GpsList({
  vehicles,
  gpsMap,
  gpsError,
}: {
  vehicles: VehicleRow[];
  gpsMap: Map<string, WialonUnit>;
  gpsError: string | null;
}) {
  const now = new Date();

  return (
    <>
      {gpsError && (
        <div className="bg-danger-tint text-danger text-[13px] font-bold px-4 py-3 rounded-xl">
          GPS серверига уланиб бўлмади: {gpsError}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_1.3fr_0.9fr_0.9fr_1fr_0.9fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Машина</div>
          <div>Ҳайдовчи</div>
          <div>Тезлик</div>
          <div>Сўнгги алоқа</div>
          <div>Жойлашув</div>
          <div></div>
        </div>
        {vehicles.map((v) => {
          const unit = gpsMap.get(v.id);
          return (
            <div
              key={v.id}
              className="grid grid-cols-2 lg:grid-cols-[1fr_1.3fr_0.9fr_0.9fr_1fr_0.9fr] gap-y-1.5 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="font-extrabold text-primary font-heading">{v.plate}</div>
              <div className="font-semibold text-heading">{v.driver?.user.fullName ?? "—"}</div>
              {unit ? (
                <>
                  <div className={`font-bold ${unit.speedKmh > 0 ? "text-success" : "text-muted-2"}`}>
                    {unit.speedKmh > 0 ? `${unit.speedKmh} км/соат` : "тўхтаган"}
                  </div>
                  <div className="text-muted-2 font-semibold text-xs">{formatAgo(unit.lastUpdate, now)}</div>
                  <div className="text-xs text-muted-2">
                    {unit.lat.toFixed(4)}, {unit.lon.toFixed(4)}
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
                <div className="text-xs text-muted-2 font-semibold col-span-2 lg:col-span-4">GPS уланмаган</div>
              )}
            </div>
          );
        })}
        {vehicles.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Фаол машина йўқ</p>}
      </Card>
    </>
  );
}
