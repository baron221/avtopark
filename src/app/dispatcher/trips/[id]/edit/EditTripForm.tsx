"use client";

import { useActionState, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { updateTripAction, type UpdateTripState } from "../../../actions";
import type { Point, TripKind } from "@prisma/client";

const initialState: UpdateTripState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function EditTripForm({
  tripId,
  kind: initialKind,
  driverId,
  passengerCount,
  revenue,
  note,
  drivers,
  point,
  backTo,
}: {
  tripId: string;
  kind: TripKind;
  driverId: string;
  passengerCount: number;
  revenue: number;
  note: string;
  drivers: { id: string; name: string }[];
  point?: Point;
  backTo: "journal" | "point";
}) {
  const [state, formAction, pending] = useActionState(updateTripAction, initialState);
  const [kind, setKind] = useState<TripKind>(initialKind);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="backTo" value={backTo} />
      {point && <input type="hidden" name="point" value={point} />}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("TRIP")}
          className={`flex-1 rounded-[10px] py-2.5 text-center font-extrabold text-[13px] ${
            kind === "TRIP" ? "bg-primary text-white" : "bg-page border-2 border-border text-muted"
          }`}
        >
          Рейс
        </button>
        <button
          type="button"
          onClick={() => setKind("ORDER")}
          className={`flex-1 rounded-[10px] py-2.5 text-center font-extrabold text-[13px] ${
            kind === "ORDER" ? "bg-primary text-white" : "bg-page border-2 border-border text-muted"
          }`}
        >
          Алоҳида заказ
        </button>
      </div>

      <div>
        <div className={labelClass}>Ҳайдовчи</div>
        <select name="driverId" defaultValue={driverId} required className={inputClass}>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {kind === "TRIP" && (
        <div>
          <div className={labelClass}>Йўловчилар сони</div>
          <input
            name="passengerCount"
            type="number"
            min={1}
            defaultValue={passengerCount}
            className={inputClass}
          />
        </div>
      )}

      <div>
        <div className={labelClass}>Сумма</div>
        <MoneyInput name="revenue" defaultValue={revenue} required className={inputClass} />
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
