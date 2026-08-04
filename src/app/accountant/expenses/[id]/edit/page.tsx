import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { EditExpenseForm } from "./EditExpenseForm";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const expense = await prisma.staffExpense.findUnique({ where: { id } });
  if (!expense) notFound();

  return (
    <div className="max-w-[480px] mx-auto w-full p-4 sm:p-7">
      <Link
        href="/accountant/expenses"
        className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
      >
        ← Орқага
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">Расходни таҳрирлаш</div>
        <EditExpenseForm
          expenseId={expense.id}
          point={expense.point}
          category={expense.category}
          amount={Number(expense.amount)}
          note={expense.note ?? ""}
        />
      </Card>
    </div>
  );
}
