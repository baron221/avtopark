import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { getWialonUnits, matchVehiclesToWialonUnits, type WialonUnit } from "@/lib/wialon";
import { GpsList } from "@/components/gps/GpsList";
import { FuelEfficiencyCard } from "@/components/gps/FuelEfficiencyCard";

export default async function OwnerGpsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"))) {
    redirect("/coming-soon");
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { status: "ACTIVE" },
    include: { driver: { include: { user: true } } },
    orderBy: { plate: "asc" },
  });

  let gpsMap = new Map<string, WialonUnit>();
  let gpsError: string | null = null;
  try {
    const units = await getWialonUnits();
    gpsMap = matchVehiclesToWialonUnits(vehicles, units);
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
          href="/owner"
          className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
        >
          ← Панел
        </Link>
      </div>

      <GpsList vehicles={vehicles} gpsMap={gpsMap} gpsError={gpsError} />
      <FuelEfficiencyCard />
    </div>
  );
}
