import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { getWialonUnits, matchVehiclesToWialonUnits, type WialonUnit } from "@/lib/wialon";
import { GpsList } from "@/components/gps/GpsList";
import { FuelEfficiencyCard } from "@/components/gps/FuelEfficiencyCard";

export default async function MechanicGpsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) {
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
      <div>
        <div className="font-heading font-bold text-xl text-heading">GPS кузатув</div>
        <div className="text-[13px] text-muted-2 font-semibold">
          {gpsMap.size} / {vehicles.length} машина уланган
        </div>
      </div>

      <GpsList vehicles={vehicles} gpsMap={gpsMap} gpsError={gpsError} />
      <FuelEfficiencyCard />
    </div>
  );
}
