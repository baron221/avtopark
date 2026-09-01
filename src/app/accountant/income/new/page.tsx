import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { getExternalVehicles } from "@/lib/externalVehicle";
import { ExternalVehicleManager } from "@/components/ExternalVehicleManager";
import { addExternalVehicleAction, deleteExternalVehicleAction } from "@/app/actions";
import { AddOtherIncomeForm } from "./AddOtherIncomeForm";

export default async function NewOtherIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { saved } = await searchParams;
  const externalVehicles = await getExternalVehicles();

  return (
    <div className="max-w-[520px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-4">
      <Link
        href="/accountant/expenses"
        className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors self-start"
      >
        ← Расходларга қайтиш
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="font-heading font-bold text-xl text-heading mb-1">Кирим қўшиш</div>
        <div className="text-[13px] text-muted-2 font-semibold mb-5">
          Ўз паркимиз машиналаридан ташқари — GPS/литсензия/ойлик хизмат учун тўлайдиган бошқа машиналардан келган пул
        </div>
        {saved === "1" && (
          <div className="bg-success-tint text-success text-[13px] font-bold px-4 py-3 rounded-xl mb-4">
            ✓ Киритилди
          </div>
        )}
        <AddOtherIncomeForm externalVehiclePlates={externalVehicles.map((v) => v.plate)} />
      </Card>

      <ExternalVehicleManager
        vehicles={externalVehicles}
        addAction={addExternalVehicleAction}
        deleteAction={deleteExternalVehicleAction}
      />
    </div>
  );
}
