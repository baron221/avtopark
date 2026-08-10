"use client";

import { useActionState, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { OwnerPayoutState } from "@/lib/ownerPayout";

const initialState: OwnerPayoutState = { error: "" };

/**
 * Sets the reconciliation point the cash balance is computed from (see
 * getCashLedgerSummary's schema comment) — the accountant physically
 * counts the cash on hand and records it here. Rendered from the shared
 * FleetDashboard, so the action comes in as a prop rather than being
 * imported directly (same reasoning as OwnerPayoutForm).
 */
export function CashOpeningBalanceForm({
  hasExisting,
  action,
}: {
  hasExisting: boolean;
  action: (prevState: OwnerPayoutState, formData: FormData) => Promise<OwnerPayoutState>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction] = useActionState(action, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-primary text-xs font-extrabold hover:underline whitespace-nowrap"
      >
        {hasExisting ? "Қолдиқни қайта белгилаш" : "Бошланғич қолдиқни белгилаш"}
      </button>
      {expanded && (
        <form action={formAction} className="mt-2 flex flex-col gap-1.5 bg-card border border-border rounded-xl p-3 w-56">
          <label className="text-[11px] font-bold text-muted-2 uppercase">Ҳозирги қўлдаги нақд пул</label>
          <MoneyInput
            name="amount"
            placeholder="Сумма"
            className="bg-page border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
          />
          <input
            type="date"
            name="date"
            defaultValue={today}
            max={today}
            required
            className="bg-page border border-border rounded-md px-2 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
          />
          <input
            type="text"
            name="note"
            placeholder="Изоҳ (ихтиёрий)"
            className="bg-page border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
          />
          {state.error && <p className="text-[11px] text-danger font-semibold">{state.error}</p>}
          <button type="submit" className="bg-primary text-white rounded-md px-2.5 py-1.5 text-xs font-extrabold">
            Тасдиқлаш
          </button>
        </form>
      )}
    </div>
  );
}
