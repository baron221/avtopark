"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateFuelLogAction, type UpdateFuelLogState } from "../../actions";

const initialState: UpdateFuelLogState = { error: "" };

type VehicleOption = { id: string; plate: string; driverName: string };
type StationOption = { id: string; name: string; fuelType: string };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditFuelLogForm({
  fuelLogId,
  vehicleId,
  stationId,
  volume,
  amount,
  vehicles,
  stations,
}: {
  fuelLogId: string;
  vehicleId: string;
  stationId: string;
  volume: number;
  amount: number;
  vehicles: VehicleOption[];
  stations: StationOption[];
}) {
  const [state, formAction, pending] = useActionState(updateFuelLogAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={fuelLogId} />

      <div>
        <div className={labelClass}>Машина</div>
        <select name="vehicleId" required className={inputClass} defaultValue={vehicleId}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate} · {v.driverName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className={labelClass}>Заправка</div>
        <select name="stationId" required className={inputClass} defaultValue={stationId}>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.fuelType}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className={labelClass}>Ҳажм (м³ ёки Л)</div>
        <input name="volume" type="number" min={1} step="0.1" required defaultValue={volume} className={inputClass} />
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
