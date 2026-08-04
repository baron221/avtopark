import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { EditAdvanceForm } from "./EditAdvanceForm";

export default async function EditAdvancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const advance = await prisma.advance.findUnique({ where: { id }, include: { user: true } });
  if (!advance) notFound();

  return (
    <div className="max-w-[480px] mx-auto w-full p-4 sm:p-7">
      <Link
        href="/accountant/advances"
        className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
      >
        ← Орқага
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">
          Авансни таҳрирлаш · {advance.user.fullName}
        </div>
        <EditAdvanceForm advanceId={advance.id} amount={Number(advance.amount)} />
      </Card>
    </div>
  );
}
