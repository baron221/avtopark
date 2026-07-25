import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { ROLE_LABELS } from "@/components/ui/RoleBadge";
import { AddFineForm } from "./AddFineForm";

export default async function NewFinePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT") redirect("/coming-soon");

  const users = await prisma.user.findMany({
    where: { role: { not: "OWNER" }, isActive: true },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });
  const options = users.map((u) => ({ id: u.id, label: `${u.fullName} · ${ROLE_LABELS[u.role]}` }));

  return (
    <div className="max-w-[520px] mx-auto w-full p-4 sm:p-7">
      <Link href="/accountant/fines" className="text-[13px] font-bold text-muted-2 hover:text-primary">
        ← Jarimalarga qaytish
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">Jarima qo&apos;shish</div>
        <AddFineForm users={options} />
      </Card>
    </div>
  );
}
