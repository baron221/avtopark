"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { createVehicleAction, type CreateVehicleState } from "../actions";

const initialState: CreateVehicleState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function CreateVehicleForm() {
  const [state, formAction, pending] = useActionState(createVehicleAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <div className={labelClass}>Давлат рақами</div>
        <input name="plate" required className={inputClass} placeholder="01 A 245 BA" />
      </div>
      <div>
        <div className={labelClass}>Модел</div>
        <input name="model" required className={inputClass} placeholder="Isuzu HC40" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>Тури</div>
          <select name="type" className={inputClass} defaultValue="AVTOBUS">
            <option value="AVTOBUS">Автобус</option>
            <option value="FURGON">Фургон</option>
          </select>
        </div>
        <div>
          <div className={labelClass}>Ўриндиқлар</div>
          <input name="seats" type="number" required min={1} className={inputClass} placeholder="40" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>Таннарх (сўм)</div>
          <MoneyInput name="purchasePrice" required className={inputClass} placeholder="320 000 000" />
        </div>
        <div>
          <div className={labelClass}>Пункт</div>
          <select name="point" className={inputClass} defaultValue="FARGONA">
            <option value="FARGONA">Фарғона</option>
            <option value="QUVA">Қува</option>
          </select>
        </div>
      </div>
      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Сақланмоқда…" : "Машина қўшиш"}
      </button>
    </form>
  );
}
