import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/access";
import { getVehiclesWithDriver } from "@/lib/vehicleWithDriver";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import { getWialonUnits, matchVehiclesToWialonUnits, getWialonTodayStatsForUnits, type WialonUnit } from "@/lib/wialon";
import { GpsList } from "@/components/gps/GpsList";
import { FuelEfficiencyCard } from "@/components/gps/FuelEfficiencyCard";
import { GpsTripComparisonCard } from "@/components/gps/GpsTripComparisonCard";
import { getGpsTripComparisonRows } from "@/lib/gpsTripComparison";

export default async function OwnerGpsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"))) {
    redirect("/coming-soon");
  }

  // Two flat queries joined in JS instead of a doubly-nested include — see
  // getVehiclesWithDriver's own comment (measured far faster against this
  // project's high-latency DB region).
  const vehicles = (await getVehiclesWithDriver())
    .filter((v) => DISPATCHABLE_STATUSES.includes(v.status))
    .sort((a, b) => a.plate.localeCompare(b.plate));

  const tripComparisonRows = await getGpsTripComparisonRows();

  let gpsMap = new Map<string, WialonUnit>();
  let todayStats = new Map<string, { kmToday: number; maxSpeedKmh: number }>();
  let gpsError: string | null = null;
  try {
    const units = await getWialonUnits();
    gpsMap = matchVehiclesToWialonUnits(vehicles, units);
    todayStats = await getWialonTodayStatsForUnits(
      vehicles.filter((v) => gpsMap.has(v.id)).map((v) => ({ vehicleId: v.id, unitId: gpsMap.get(v.id)!.id }))
    );
  } catch (err) {
    console.error("Wialon GPS xato:", err);
    gpsError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">GPS кузатув</div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {gpsMap.size} / {vehicles.length} машина уланган
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/owner/gps/history"
            className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
          >
            Йўл тарихи
          </Link>
          <Link
            href="/owner"
            className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
          >
            ← Панел
          </Link>
        </div>
      </div>

      <GpsList vehicles={vehicles} gpsMap={gpsMap} todayStats={todayStats} gpsError={gpsError} />
      <GpsTripComparisonCard rows={tripComparisonRows} />
      <FuelEfficiencyCard />
    </div>
  );
}
