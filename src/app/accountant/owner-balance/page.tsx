import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { OwnerBalanceCards } from "@/components/dashboard/OwnerBalanceCards";
import { OwnerBalanceHistory } from "@/components/dashboard/OwnerBalanceHistory";
import { getLastOwnerBalanceReport, getMechanicCostSummary, getOwnerBalanceExpenses } from "@/lib/ownerPayout";
import { SendDailyClosingButton } from "@/components/dashboard/SendDailyClosingButton";
import { AddOwnerExpenseForm } from "./AddOwnerExpenseForm";
import { deleteOwnerBalanceExpenseAction, sendOwnerBalanceReportAction } from "./actions";

/** Accountant-only, like /accountant/debtors — recording what was spent out
 * of the owner's balance is the accountant's job; owner/admin/mechanic see
 * the same figures (and this list, read-only) on their own pages. */
export default async function OwnerBalancePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT") redirect("/coming-soon");

  const [summary, expenses, lastReport] = await Promise.all([
    getMechanicCostSummary(),
    getOwnerBalanceExpenses(),
    getLastOwnerBalanceReport(),
  ]);

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Банкдаги пул</div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Эгасига топширилган пул + қарздан келган пул − ёқилғи, мой ва қуйида ёзилган бошқа сарфлар
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <SendDailyClosingButton
            action={sendOwnerBalanceReportAction}
            label="Telegram'га жўнатиш"
            confirmText="Охирги ҳисоботдан кейинги янги кирим ва расходларни Telegram орқали эгасига жўнатишни тасдиқлайсизми?"
          />
          <div className="text-[11px] text-muted-2 font-semibold">
            {lastReport
              ? `Охирги ҳисобот: ${lastReport.sentAt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" })}`
              : "Ҳисобот ҳали жўнатилмаган"}
          </div>
        </div>
      </div>

      <OwnerBalanceCards summary={summary} />

      <Card className="p-5 flex flex-col gap-3">
        <div className="font-heading font-bold text-base text-heading">Банкдаги пулдан сарф қўшиш</div>
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
