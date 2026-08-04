"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateExpenseAction, type UpdateExpenseState } from "../../actions";

const initialState: UpdateExpenseState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditExpenseForm({
  expenseId,
  point,
  category,
  amount,
  note,
}: {
  expenseId: string;
  point: string;
  category: string;
  amount: number;
  note: string;
}) {
  const [state, formAction, pending] = useActionState(updateExpenseAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={expenseId} />

      <div>
        <div className={labelClass}>Пункт</div>
        <select name="point" required className={inputClass} defaultValue={point}>
          <option value="FARGONA">Фарғона</option>
          <option value="QUVA">Қува</option>
          <option value="YOLDA">Йўлда</option>
          <option value="ISHXONA">Ишхона</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Тоифа</div>
        <select name="category" required className={inputClass} defaultValue={category}>
          <option value="STOYANKA">Стоянка</option>
          <option value="OZIQ_OVQAT">Озиқ-овқат</option>
          <option value="OBED">Обед</option>
          <option value="BOSHQA">Бошқа</option>
        </select>
      </div>
      <div>
        <div className={labelClass}>Сумма</div>
        <MoneyInput name="amount" defaultValue={amount} required className={inputClass} />
      </div>
      <div>
        <div className={labelClass}>Изоҳ</div>
        <input name="note" defaultValue={note} className={inputClass} placeholder="Ихтиёрий" />
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
