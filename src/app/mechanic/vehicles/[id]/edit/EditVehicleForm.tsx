"use client";

import { useActionState } from "react";
import { updateVehicleAction, type UpdateVehicleState } from "../actions";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { Point, VehicleType } from "@prisma/client";

const initialState: UpdateVehicleState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

type Props = {
  vehicleId: string;
  plate: string;
  model: string;
  type: VehicleType;
  seats: number;
  purchasePrice: number;
  point: Point | null;
};

export function EditVehicleForm({ vehicleId, plate, model, type, seats, purchasePrice, point }: Props) {
  const [state, formAction, pending] = useActionState(updateVehicleAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div>
        <div className={labelClass}>Давлат рақами</div>
        <input name="plate" required defaultValue={plate} className={inputClass} />
      </div>
      <div>
        <div className={labelClass}>Модел</div>
        <input name="model" required defaultValue={model} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>Тури</div>
          <select name="type" className={inputClass} defaultValue={type}>
            <option value="AVTOBUS">Автобус</option>
            <option value="FURGON">Фургон</option>
          </select>
        </div>
        <div>
          <div className={labelClass}>Ўриндиқлар</div>
          <input name="seats" type="number" required min={1} defaultValue={seats} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className={labelClass}>Таннарх (сўм)</div>
          <MoneyInput name="purchasePrice" required defaultValue={purchasePrice} className={inputClass} />
        </div>
        <div>
          <div className={labelClass}>Пункт</div>
          <select name="point" className={inputClass} defaultValue={point ?? "FARGONA"}>
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
        {pending ? "Сақланмоқда…" : "Сақлаш"}
      </button>
    </form>
  );
}
