import { Card } from "@/components/ui/Card";
import { getFuelEfficiencyRows } from "@/lib/fuelEfficiency";

const FUEL_LABELS: Record<string, string> = { METAN: "Газ", BENZIN: "Бензин", DIZEL: "Дизель" };
const FUEL_UNIT: Record<string, string> = { METAN: "м³", BENZIN: "л", DIZEL: "л" };

export async function FuelEfficiencyCard() {
  const rows = await getFuelEfficiencyRows();
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-3.5">
        <div className="font-heading font-bold text-base text-heading">Ёқилғи самарадорлиги · шу ой</div>
        <div className="text-xs text-muted-2 font-semibold mt-0.5">
          Ҳар 100 км учун сарф — паркнинг ўртачасидан кўп бўлса белгиланади
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-[1fr_1.2fr_0.9fr_1fr_1fr_1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
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
          className="grid grid-cols-2 lg:grid-cols-[1fr_1.2fr_0.9fr_1fr_1fr_1fr] gap-y-1.5 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
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
  );
}
