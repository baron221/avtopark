"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateLunchAction, type UpdateLunchState } from "../../../actions";
import type { Point } from "@prisma/client";

const initialState: UpdateLunchState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditLunchForm({
  lunchId,
  amount,
  point,
  backTo,
}: {
  lunchId: string;
  amount: number;
  point?: Point;
  backTo: "journal" | "point";
}) {
  const [state, formAction, pending] = useActionState(updateLunchAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={lunchId} />
      <input type="hidden" name="backTo" value={backTo} />
      {point && <input type="hidden" name="point" value={point} />}

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
