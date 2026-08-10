"use client";

import { useActionState, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { ConfirmHandoverState } from "../actions";

const initialState: ConfirmHandoverState = { error: "" };

export function HandoverForm({
  point,
  computedAmount,
  action,
  adjustAction,
}: {
  point?: string;
  computedAmount: number;
  action: (formData: FormData) => Promise<void>;
  adjustAction: (prevState: ConfirmHandoverState, formData: FormData) => Promise<ConfirmHandoverState>;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [state, formAction] = useActionState(adjustAction, initialState);

  if (adjusting) {
    return (
      <form action={formAction} className="flex flex-col gap-1.5 bg-page border border-border rounded-xl p-3 w-full sm:w-64">
        {point && <input type="hidden" name="point" value={point} />}
        <label className="text-[11px] font-bold text-muted-2 uppercase">Ҳақиқий сумма</label>
        <MoneyInput
          name="amount"
          defaultValue={computedAmount}
          autoFocus
          className="bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
        />
        <label className="text-[11px] font-bold text-muted-2 uppercase">Сабаби</label>
        <input
          type="text"
          name="note"
          placeholder="Нима учун сумма фарқ қилади"
          required
          className="bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
        />
        {state.error && <p className="text-[11px] text-danger font-semibold">{state.error}</p>}
        <div className="flex gap-1.5">
          <button type="submit" className="flex-1 bg-success text-white rounded-md px-2.5 py-1.5 text-xs font-extrabold">
            Топшириш ✓
          </button>
          <button
            type="button"
            onClick={() => setAdjusting(false)}
            className="bg-card border border-border text-muted rounded-md px-2.5 py-1.5 text-xs font-extrabold"
          >
            Бекор
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <button
        type="button"
        onClick={() => setAdjusting(true)}
        className="text-primary text-xs font-extrabold hover:underline whitespace-nowrap"
      >
        Тузатиш
      </button>
      <form action={action}>
        {point && <input type="hidden" name="point" value={point} />}
        <button type="submit" className="bg-success text-white rounded-[10px] px-5 py-2.5 font-extrabold text-[13px]">
          Топшириш ✓
        </button>
      </form>
    </div>
  );
}
