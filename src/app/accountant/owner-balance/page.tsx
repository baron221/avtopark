import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { OwnerBalanceCards } from "@/components/dashboard/OwnerBalanceCards";
import { OwnerBalanceHistory } from "@/components/dashboard/OwnerBalanceHistory";
import { getMechanicCostSummary, getOwnerBalanceExpenses } from "@/lib/ownerPayout";
import { AddOwnerExpenseForm } from "./AddOwnerExpenseForm";
import { deleteOwnerBalanceExpenseAction } from "./actions";

/** Accountant-only, like /accountant/debtors — recording what was spent out
 * of the owner's balance is the accountant's job; owner/admin/mechanic see
 * the same figures (and this list, read-only) on their own pages. */
export default async function OwnerBalancePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT") redirect("/coming-soon");

  const [summary, expenses] = await Promise.all([getMechanicCostSummary(), getOwnerBalanceExpenses()]);

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Эгасининг қолдиғи</div>
        <div className="text-[13px] text-muted-2 font-semibold">
          Эгасига топширилган пул + қарздан келган пул − ёқилғи, мой ва қуйида ёзилган бошқа сарфлар
        </div>
      </div>

      <OwnerBalanceCards summary={summary} />

      <Card className="p-5 flex flex-col gap-3">
        <div className="font-heading font-bold text-base text-heading">Эгасининг ҳисобидан сарф қўшиш</div>
        <div className="text-xs text-muted-2 font-semibold">
          Ёқилғи заправка тўловлари ва мой алмаштириш механик киритганда ўзи ҳисобга тушади — уларни бу ерга
          ёзманг. Бу ерга фақат бошқа сарфларни ёзинг.
        </div>
        <AddOwnerExpenseForm />
      </Card>

      <OwnerBalanceHistory rows={expenses} deleteAction={deleteOwnerBalanceExpenseAction} />
    </div>
  );
}
