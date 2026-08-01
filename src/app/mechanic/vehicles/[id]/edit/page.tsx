import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { EditVehicleForm } from "./EditVehicleForm";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) notFound();

  return (
    <div className="max-w-[520px] mx-auto w-full p-4 sm:p-7">
      <Link href={`/mechanic/vehicles/${vehicle.id}`} className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors">
        ← {vehicle.plate}га қайтиш
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">Машина маълумотларини таҳрирлаш</div>
        <EditVehicleForm
          vehicleId={vehicle.id}
          plate={vehicle.plate}
          model={vehicle.model}
          type={vehicle.type}
          seats={vehicle.seats}
          purchasePrice={Number(vehicle.purchasePrice)}
          point={vehicle.point}
        />
      </Card>
    </div>
  );
}
