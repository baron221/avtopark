"use client";

import { useActionState, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatSom } from "@/lib/format";
import type { OwnerPayoutState } from "@/lib/ownerPayout";
import type { Point } from "@prisma/client";

const initialState: OwnerPayoutState = { error: "" };

/**
 * Rendered from the shared FleetDashboard, which must not import an
 * accountant-scoped server action directly (that would hard-couple a
 * component Owner/Admin also use to one specific caller) — so the action
 * comes in as a prop instead, same as DriverTripsTable's deleteAction.
 */
export function OwnerPayoutForm({
  point,
  balance,
  action,
}: {
  point: Point;
  balance: number;
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
        className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap"
      >
        Эгасига тўладим
      </button>
      {expanded && (
        <form action={formAction} className="mt-2 flex flex-col gap-1.5 bg-page rounded-xl p-3 w-56">
          <input type="hidden" name="point" value={point} />
          <label className="text-[11px] font-bold text-muted-2 uppercase">
            Сумма (қолдиқ: {formatSom(balance)})
          </label>
          <MoneyInput
            name="amount"
            placeholder="Сумма"
            className="bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
          />
          <input
            type="date"
            name="date"
            defaultValue={today}
            max={today}
            required
            className="bg-card border border-border rounded-md px-2 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
          />
          <input
            type="text"
            name="note"
            placeholder="Изоҳ (ихтиёрий)"
            className="bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
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
