"use client";

import { useActionState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateStationPaymentAction, type UpdateStationPaymentState } from "../../actions";

const initialState: UpdateStationPaymentState = { error: "" };

type StationOption = { id: string; name: string };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditStationPaymentForm({
  paymentId,
  stationId,
  periodStart,
  periodEnd,
  totalVolume,
  amount,
  stations,
}: {
  paymentId: string;
  stationId: string;
  periodStart: string;
  periodEnd: string;
  totalVolume: number;
  amount: number;
  stations: StationOption[];
}) {
  const [state, formAction, pending] = useActionState(updateStationPaymentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={paymentId} />

      <div>
        <div className={labelClass}>Заправка</div>
        <select name="stationId" required className={inputClass} defaultValue={stationId}>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>Давр боши</div>
          <input name="periodStart" type="date" required defaultValue={periodStart} className={inputClass} />
        </div>
        <div>
          <div className={labelClass}>Давр охири</div>
          <input name="periodEnd" type="date" required defaultValue={periodEnd} className={inputClass} />
        </div>
      </div>
      <div>
        <div className={labelClass}>Жами ҳажм</div>
        <input
          name="totalVolume"
          type="number"
          min={1}
          step="0.1"
          required
          defaultValue={totalVolume}
          className={inputClass}
        />
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
