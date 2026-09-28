"use client";

import { formatSom } from "@/lib/format";
import { revertTripDebtSettlementAction } from "./actions";

/** Same reason as SettleDebtButton for being its own "use client" file —
 * the confirm needs an onSubmit handler, which a server-component page
 * can't pass to a plain <form>. */
export function RevertDebtButton({ id, amount }: { id: string; amount: number }) {
  return (
    <form
      action={revertTripDebtSettlementAction}
      onSubmit={(e) => {
        if (!window.confirm(`${formatSom(amount)} тўланди деганини бекор қилиб, қарзни қайтарасизми?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="bg-card border border-border text-body rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap hover:border-danger hover:text-danger transition-colors"
      >
        Қайтариш
      </button>
    </form>
  );
}
