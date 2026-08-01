import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { EditUserForm } from "./EditUserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && !(await hasModuleAccess(session.user.role, "USER_MANAGEMENT"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, include: { driver: true } });
  if (!user) notFound();

  return (
    <div className="max-w-[520px] mx-auto w-full p-4 sm:p-7">
      <Link href="/admin/users" className="text-[13px] font-bold text-muted-2 hover:text-primary">
        ← Фойдаланувчиларга қайтиш
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">Фойдаланувчини таҳрирлаш</div>
        <EditUserForm
          userId={user.id}
          fullName={user.fullName}
          phone={user.phone}
          role={user.role}
          point={user.point}
          baseSalary={user.baseSalary !== null ? Number(user.baseSalary) : null}
          driver={
            user.driver
              ? {
                  licenseNo: user.driver.licenseNo,
                  salaryType: user.driver.salaryType,
                  salaryValue: Number(user.driver.salaryValue),
                }
              : null
          }
        />
      </Card>
    </div>
  );
}
