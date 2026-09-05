import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { getVehiclesWithDriver } from "@/lib/vehicleWithDriver";
import { EditFuelLogForm } from "./EditFuelLogForm";

export default async function EditFuelLogPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "FUEL"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const [fuelLog, allVehicles, stations] = await Promise.all([
    prisma.fuelLog.findUnique({ where: { id } }),
    // Two flat queries joined in JS instead of a doubly-nested include (see
    // getVehiclesWithDriver's own comment). Unfiltered by status — a
    // historical entry may reference a vehicle that's since gone under
    // repair/rented, and editing it shouldn't drop that option from the list.
    getVehiclesWithDriver(),
    prisma.fuelStation.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!fuelLog) notFound();

  const vehicles = allVehicles.sort((a, b) => a.plate.localeCompare(b.plate));
  const vehicleOptions = vehicles
    .filter((v) => v.driver)
    .map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver!.user.fullName }));
  const stationOptions = stations.map((s) => ({ id: s.id, name: s.name, fuelType: s.fuelType }));

  return (
    <div className="max-w-[480px] mx-auto w-full p-4 sm:p-7">
      <Link
        href="/mechanic/fuel"
        className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
      >
        ← Орқага
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">Қуйиш ёзувини таҳрирлаш</div>
        <EditFuelLogForm
          fuelLogId={fuelLog.id}
          vehicleId={fuelLog.vehicleId}
          stationId={fuelLog.stationId}
          volume={Number(fuelLog.volume)}
          amount={Number(fuelLog.amount)}
          filledAt={fuelLog.filledAt.toISOString().slice(0, 10)}
          vehicles={vehicleOptions}
          stations={stationOptions}
        />
      </Card>
    </div>
  );
}
