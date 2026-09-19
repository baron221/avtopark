"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addOwnerBalanceExpenseAction, type OwnerBalanceExpenseState } from "./actions";

const initialState: OwnerBalanceExpenseState = { error: "" };

export function AddOwnerExpenseForm() {
  const [state, formAction, pending] = useActionState(addOwnerBalanceExpenseAction, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="date"
          type="date"
          required
          defaultValue={today}
          max={today}
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        />
        <MoneyInput
          name="amount"
          required
          placeholder="Сумма"
          className="w-40 bg-page border-2 border-primary rounded-xl px-3.5 py-2.5 font-heading text-base font-bold text-heading outline-none"
        />
        <input
          name="note"
          required
          placeholder="Нимага сарфланди"
          className="flex-1 min-w-[180px] bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary-tint text-primary rounded-xl px-4 font-extrabold text-sm disabled:opacity-60"
        >
          + Қўшиш
        </button>
      </div>
      {state.error && <p className="text-[13px] text-danger font-semibold">{state.error}</p>}
    </form>
  );
}
