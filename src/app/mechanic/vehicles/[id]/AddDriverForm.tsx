"use client";

import { useState, useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { createDriverAction, type CreateDriverState } from "./actions";

const initialState: CreateDriverState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-lg px-3 py-2 text-[13px] font-bold text-heading outline-none focus:border-primary";

export function AddDriverForm({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createDriverAction, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-extrabold text-primary hover:underline whitespace-nowrap"
      >
        + Янги ҳайдовчи
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2.5 bg-page border border-border rounded-xl p-4 w-full max-w-[360px]"
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="font-extrabold text-sm text-heading">Янги ҳайдовчи қўшиш</div>
      <input name="fullName" required placeholder="Ф.И.Ш." className={inputClass} />
      <input name="phone" type="tel" required placeholder="+998 91 234 56 78" className={inputClass} />
      <input name="password" type="text" required minLength={6} placeholder="Бошланғич парол (камида 6 белги)" className={inputClass} />
      <input name="licenseNo" placeholder="Гувоҳнома рақами" className={inputClass} />
      <div className="grid grid-cols-2 gap-2">
        <select name="salaryType" defaultValue="FIXED" className={inputClass}>
          <option value="FIXED">Белгиланган</option>
          <option value="PERCENT">Фоиз</option>
          <option value="PLAN_SURPLUS">Пландан ортиғи</option>
        </select>
        <MoneyInput name="salaryValue" placeholder="3 000 000" className={inputClass} />
      </div>
      {state.error && <p className="text-danger text-xs font-bold">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-primary text-white rounded-lg py-2 text-xs font-extrabold disabled:opacity-60"
        >
          {pending ? "Сақланмоқда…" : "Қўшиш ва бириктириш"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold text-muted-2 px-3"
        >
          Бекор қилиш
        </button>
      </div>
    </form>
  );
}
