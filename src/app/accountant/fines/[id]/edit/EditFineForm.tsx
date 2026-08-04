"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateFineAction, type UpdateFineState } from "../../actions";

const initialState: UpdateFineState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditFineForm({ fineId, amount, reason }: { fineId: string; amount: number; reason: string }) {
  const [state, formAction, pending] = useActionState(updateFineAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={fineId} />

      <div>
        <div className={labelClass}>Сабаб</div>
        <input name="reason" defaultValue={reason} required className={inputClass} />
      </div>

      <div>
        <div className={labelClass}>Сумма</div>
        <MoneyInput name="amount" defaultValue={amount} required className={inputClass} />
      </div>

      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Сақланмоқда…" : "Сақлаш"}
      </button>
    </form>
  );
}
