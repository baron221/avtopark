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
        <div className={labelClass}>Пункт</div>
        <select name="point" required className={inputClass} defaultValue="FARGONA">
          <option value="FARGONA">Фарғона</option>
          <option value="QUVA">Қува</option>
          <option value="YOLDA">Йўлда</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Тоифа</div>
        <select name="category" required className={inputClass} defaultValue="BOSHQA">
          <option value="STOYANKA">Стоянка</option>
          <option value="OZIQ_OVQAT">Озиқ-овқат</option>
          <option value="BOSHQA">Бошқа</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Сумма</div>
        <MoneyInput name="amount" required className={inputClass} placeholder="50 000" />
      </div>
      <div>
        <div className={labelClass}>Изоҳ</div>
        <input name="note" className={inputClass} placeholder="Ихтиёрий" />
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
