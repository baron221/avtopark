import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import { getWialonUnits, matchVehiclesToWialonUnits, getWialonTodayStatsForUnits, type WialonUnit } from "@/lib/wialon";
import { GpsList } from "@/components/gps/GpsList";
import { FuelEfficiencyCard } from "@/components/gps/FuelEfficiencyCard";
import { GpsTripComparisonCard } from "@/components/gps/GpsTripComparisonCard";
import { getGpsTripComparisonRows } from "@/lib/gpsTripComparison";

export default async function MechanicGpsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) {
    redirect("/coming-soon");
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { status: { in: DISPATCHABLE_STATUSES } },
    include: { driver: { include: { user: true } } },
    orderBy: { plate: "asc" },
  });

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
        <Link
          href="/mechanic/gps/history"
          className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
        >
          Йўл тарихи
        </Link>
      </div>

      <GpsList vehicles={vehicles} gpsMap={gpsMap} todayStats={todayStats} gpsError={gpsError} />
      <GpsTripComparisonCard rows={tripComparisonRows} />
      <FuelEfficiencyCard />
    </div>
  );
}
