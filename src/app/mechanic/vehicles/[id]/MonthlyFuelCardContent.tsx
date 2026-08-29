import { getVehicleMonthlyFuelReport } from "@/lib/monthlyFuelReport";

const FUEL_LABELS: Record<string, string> = { METAN: "Газ", BENZIN: "Бензин", DIZEL: "Дизель" };
const FUEL_UNIT: Record<string, string> = { METAN: "м³", BENZIN: "л", DIZEL: "л" };

/**
 * Split out of the vehicle page itself and rendered inside a <Suspense>
 * boundary there — the fast path here is DB-only, but a month with gaps in
 * its daily VehicleMileage snapshots falls back to a live Wialon range
 * query that the report's own doc comment says can take ~10s against the
 * self-hosted server. That used to block the *entire* vehicle page from
 * rendering; now only this one card waits on it.
 */
export async function MonthlyFuelCardContent({
  vehicleId,
  unitId,
  fuelMonth,
  fuelRangeTo,
}: {
  vehicleId: string;
  unitId: number;
  fuelMonth: Date;
  fuelRangeTo: Date;
}) {
  let monthlyFuelReport: Awaited<ReturnType<typeof getVehicleMonthlyFuelReport>> | null = null;
  try {
    monthlyFuelReport = await getVehicleMonthlyFuelReport(vehicleId, unitId, fuelMonth, fuelRangeTo);
  } catch (err) {
    console.error("Ойлик ёқилғи ҳисоботи хато:", err);
  }

  if (!monthlyFuelReport) {
    return <p className="text-[13px] text-muted-2 px-6 pb-5">GPS маълумотини олиб бўлмади</p>;
  }

  return (
    <>
      <div className="px-6 pb-3 flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted-2 font-semibold">Масофа:</span>
        <span className="font-extrabold text-heading">
          {monthlyFuelReport.km > 0 ? `${monthlyFuelReport.km.toFixed(0)} км` : "—"}
        </span>
        {monthlyFuelReport.kmIsLive && (
          <span className="bg-primary-tint text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            GPS тарихидан ҳисобланди
          </span>
        )}
      </div>
      {monthlyFuelReport.byType.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 pb-5">
          {monthlyFuelReport.byType.map((t) => (
            <div key={t.fuelType} className="bg-page rounded-xl p-3.5 flex flex-col gap-1">
              <div className="text-xs font-extrabold text-muted-2 uppercase">{FUEL_LABELS[t.fuelType] ?? t.fuelType}</div>
              <div className="font-heading font-extrabold text-lg text-heading">
                {t.volume.toFixed(1)} {FUEL_UNIT[t.fuelType] ?? ""}
              </div>
              <div className="text-xs text-muted-2 font-semibold">
                {t.ratePer100 !== null
                  ? `100 км га ${t.ratePer100.toFixed(1)} ${FUEL_UNIT[t.fuelType] ?? ""}`
                  : "масофа маълум эмас"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-2 px-6 pb-5">Бу ойда ёқилғи қуйиш ёзуви йўқ</p>
      )}
    </>
  );
}
