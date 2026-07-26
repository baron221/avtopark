"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addStaffExpenseAction, type AddExpenseState } from "../actions";

const initialState: AddExpenseState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function AddExpenseForm() {
  const [state, formAction, pending] = useActionState(addStaffExpenseAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <div className={labelClass}>Punkt</div>
        <select name="point" required className={inputClass} defaultValue="FARGONA">
          <option value="FARGONA">Farg&apos;ona</option>
          <option value="QUVA">Quva</option>
          <option value="YOLDA">Yo&apos;lda</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Toifa</div>
        <select name="category" required className={inputClass} defaultValue="BOSHQA">
          <option value="STOYANKA">Stoyanka</option>
          <option value="OZIQ_OVQAT">Oziq-ovqat</option>
          <option value="BOSHQA">Boshqa</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Summa</div>
        <MoneyInput name="amount" required className={inputClass} placeholder="50 000" />
      </div>
      <div>
        <div className={labelClass}>Izoh</div>
        <input name="note" className={inputClass} placeholder="Ixtiyoriy" />
      </div>

      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </form>
  );
}
