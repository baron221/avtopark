import { Card } from "@/components/ui/Card";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatSom } from "@/lib/format";
import type { OwnerBalanceExpenseRow } from "@/lib/ownerPayout";

/** Expenses recorded by hand against the owner's balance. Read-only unless a
 * deleteAction is passed — only the accountant's own page passes one, the
 * owner/admin/mechanic views just see the list. The action comes in as a
 * prop for the same reason as OwnerPayoutForm's: this lives in the shared
 * components/ folder and must not import a route-local server action. */
export function OwnerBalanceHistory({
  rows,
  deleteAction,
}: {
  rows: OwnerBalanceExpenseRow[];
  deleteAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-3.5 font-heading font-bold text-base text-heading">
        Жак ҳаққидан қилинган бошқа сарфлар
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[0.7fr_2fr_1fr_auto] px-6 py-3 border-t border-row-divider items-center text-sm gap-2"
        >
          <div className="text-muted-2 font-bold">
            {r.expenseDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </div>
          <div className="min-w-0">
            <div className="text-body font-semibold">{r.note}</div>
            <div className="text-xs text-muted-2 font-semibold">{r.enteredByName}</div>
          </div>
          <div className="font-extrabold text-heading text-right">−{formatSom(r.amount)}</div>
          {deleteAction ? (
            <ConfirmDeleteButton
              action={deleteAction}
              id={r.id}
              confirmText="Бу сарфни ўчиришни тасдиқлайсизми?"
              className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1"
            />
          ) : (
            <span />
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳали бошқа сарф ёзилмаган</p>}
    </Card>
  );
}
