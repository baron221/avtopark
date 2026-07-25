import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CreateVehicleForm } from "./CreateVehicleForm";

export default async function NewVehiclePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  return (
    <div className="max-w-[520px] mx-auto w-full p-4 sm:p-7">
      <Link href="/mechanic/vehicles" className="text-[13px] font-bold text-muted-2 hover:text-primary">
        ← Mashinalarga qaytish
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">Yangi mashina qo&apos;shish</div>
        <CreateVehicleForm />
      </Card>
    </div>
  );
}
