"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateStaffExpenseAction, type UpdateStaffExpenseState } from "../../../actions";
import type { Point, StaffExpenseCategory } from "@prisma/client";

const initialState: UpdateStaffExpenseState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditExpenseForm({
  expenseId,
  category,
  amount,
  note,
  point,
  backTo,
}: {
  expenseId: string;
  category: StaffExpenseCategory;
  amount: number;
  note: string;
  point?: Point;
  backTo: "journal" | "point";
}) {
  const [state, formAction, pending] = useActionState(updateStaffExpenseAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={expenseId} />
      <input type="hidden" name="backTo" value={backTo} />
      {point && <input type="hidden" name="point" value={point} />}

      <div>
        <div className={labelClass}>Тоифа</div>
        <select name="category" defaultValue={category} required className={inputClass}>
          <option value="STOYANKA">Стоянка</option>
          <option value="OZIQ_OVQAT">Озиқ-овқат</option>
          <option value="BOSHQA">Бошқа</option>
        </select>
      </div>

      <div>
        <div className={labelClass}>Сумма</div>
        <MoneyInput name="amount" defaultValue={amount} required className={inputClass} />
      </div>

      <div>
        <div className={labelClass}>Изоҳ</div>
        <input name="note" defaultValue={note} className={inputClass} />
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
