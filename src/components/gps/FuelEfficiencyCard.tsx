import { Card } from "@/components/ui/Card";
import { getFuelEfficiencyRows } from "@/lib/fuelEfficiency";

const FUEL_LABELS: Record<string, string> = { METAN: "Газ", BENZIN: "Бензин", DIZEL: "Дизель" };
const FUEL_UNIT: Record<string, string> = { METAN: "м³", BENZIN: "л", DIZEL: "л" };

export async function FuelEfficiencyCard() {
  const rows = await getFuelEfficiencyRows();
  if (rows.length === 0) return null;

  return (
    <>
      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="px-6 py-3.5">
          <div className="font-heading font-bold text-base text-heading">Ёқилғи самарадорлиги · шу ой</div>
          <div className="text-xs text-muted-2 font-semibold mt-0.5">
            Ҳар 100 км учун сарф — паркнинг ўртачасидан кўп бўлса белгиланади
          </div>
        </div>
        <div className="grid grid-cols-[1fr_1.2fr_0.9fr_1fr_1fr_1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Машина</div>
          <div>Ҳайдовчи</div>
          <div>Ёқилғи</div>
          <div>Масофа</div>
          <div>100 км га</div>
          <div>Парк ўртачаси</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.vehicleId}
            className="grid grid-cols-[1fr_1.2fr_0.9fr_1fr_1fr_1fr] gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="font-extrabold text-primary font-heading">{r.plate}</div>
            <div className="font-semibold text-heading">{r.driverName}</div>
            <div className="text-body font-bold">{FUEL_LABELS[r.fuelType] ?? r.fuelType}</div>
            <div className="text-body font-bold">{r.km > 0 ? `${r.km.toFixed(0)} км` : "—"}</div>
            <div className={`font-extrabold ${r.isAnomalous ? "text-danger" : "text-heading"}`}>
              {r.ratePer100 !== null ? `${r.ratePer100.toFixed(1)} ${FUEL_UNIT[r.fuelType] ?? ""}` : "—"}
              {r.isAnomalous && (
                <span className="ml-1.5 bg-danger-tint text-danger text-[10px] font-extrabold px-1.5 py-0.5 rounded-full align-middle">
                  ⚠ меъёрдан кўп
                </span>
              )}
            </div>
            <div className="text-muted-2 font-semibold">
              {r.fleetAvgRatePer100 !== null ? `${r.fleetAvgRatePer100.toFixed(1)} ${FUEL_UNIT[r.fuelType] ?? ""}` : "—"}
            </div>
          </div>
        ))}
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        <div className="px-1">
          <div className="font-heading font-bold text-base text-heading">Ёқилғи самарадорлиги · шу ой</div>
          <div className="text-xs text-muted-2 font-semibold mt-0.5">
            Ҳар 100 км учун сарф — паркнинг ўртачасидан кўп бўлса белгиланади
          </div>
        </div>
        {rows.map((r) => (
          <Card key={r.vehicleId} className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-extrabold text-primary font-heading">{r.plate}</div>
                <div className="text-xs text-heading font-semibold mt-0.5">{r.driverName}</div>
              </div>
              <span className="bg-page border border-border text-muted text-xs font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap">
                {FUEL_LABELS[r.fuelType] ?? r.fuelType}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-row-divider text-xs">
              <span className="text-muted-2 font-semibold">Масофа: {r.km > 0 ? `${r.km.toFixed(0)} км` : "—"}</span>
              <span className="text-muted-2 font-semibold">
                Парк ўртачаси: {r.fleetAvgRatePer100 !== null ? `${r.fleetAvgRatePer100.toFixed(1)} ${FUEL_UNIT[r.fuelType] ?? ""}` : "—"}
              </span>
            </div>
            <div className={`font-extrabold text-sm flex items-center gap-1.5 ${r.isAnomalous ? "text-danger" : "text-heading"}`}>
              100 км га: {r.ratePer100 !== null ? `${r.ratePer100.toFixed(1)} ${FUEL_UNIT[r.fuelType] ?? ""}` : "—"}
              {r.isAnomalous && (
                <span className="bg-danger-tint text-danger text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  ⚠ меъёрдан кўп
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
