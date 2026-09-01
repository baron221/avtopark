"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addOtherIncomeAction, type AddOtherIncomeState } from "../actions";
import { OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";

const initialState: AddOtherIncomeState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function AddOtherIncomeForm({ externalVehiclePlates }: { externalVehiclePlates: string[] }) {
  const [state, formAction, pending] = useActionState(addOtherIncomeAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <div className={labelClass}>Пункт</div>
        <select name="point" required className={inputClass} defaultValue="FARGONA">
          <option value="FARGONA">Фарғона</option>
          <option value="QUVA">Қува</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Тўлов тури</div>
        <select name="category" required className={inputClass} defaultValue="OYLIK_TOLOV">
          {OTHER_INCOME_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {OTHER_INCOME_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className={labelClass}>Машина рақами</div>
        <input
          name="plateNumber"
          list="other-income-external-plates"
          autoComplete="off"
          placeholder="Масалан: 40 O 370 LB"
          className={inputClass}
        />
        <datalist id="other-income-external-plates">
          {externalVehiclePlates.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div>
        <div className={labelClass}>Сумма</div>
        <MoneyInput name="amount" required className={inputClass} placeholder="500 000" />
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
