import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && !(await hasModuleAccess(session.user.role, "USER_MANAGEMENT"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="max-w-[520px] mx-auto w-full p-4 sm:p-7">
      <Link href="/admin/users" className="text-[13px] font-bold text-muted-2 hover:text-primary">
        ← Фойдаланувчиларга қайтиш
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading">Паролни янгилаш</div>
        <div className="text-[13px] text-muted-2 font-semibold mt-1 mb-5">
          {user.fullName} · {user.phone}
        </div>
        <ResetPasswordForm userId={user.id} />
      </Card>
    </div>
  );
}
