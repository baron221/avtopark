"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addTripAction } from "../actions";
import type { Point } from "@prisma/client";

type VehicleOption = { id: string; plate: string; driverName: string };

export function IncomeForm({
  vehicles,
  baseFare,
  point,
}: {
  vehicles: VehicleOption[];
  baseFare: number;
  /** Set only for a granted non-Dispatcher visitor, who has no point of their own. */
  point?: Point;
}) {
  const [kind, setKind] = useState<"TRIP" | "ORDER">("TRIP");
  const [passengerCount, setPassengerCount] = useState(10);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-success">+ Kirim kiritish</div>
      <form action={addTripAction} className="flex flex-col gap-3">
        <input type="hidden" name="kind" value={kind} />
        {point && <input type="hidden" name="point" value={point} />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind("TRIP")}
            className={`flex-1 rounded-[10px] py-2.5 text-center font-extrabold text-[13px] ${
              kind === "TRIP" ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            Reys
          </button>
          <button
            type="button"
            onClick={() => setKind("ORDER")}
            className={`flex-1 rounded-[10px] py-2.5 text-center font-extrabold text-[13px] ${
              kind === "ORDER" ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            Alohida zakaz
          </button>
        </div>

        <select
          name="vehicleId"
          required
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-success"
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate} · {v.driverName}
            </option>
          ))}
        </select>

        {kind === "TRIP" ? (
          <>
            <input
              name="passengerCount"
              type="number"
              min={1}
              value={passengerCount}
              onChange={(e) => setPassengerCount(Number(e.target.value) || 0)}
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-success"
              placeholder="Yo'lovchilar soni"
            />
            <MoneyInput
              name="revenue"
              defaultValue={passengerCount * baseFare}
              key={passengerCount}
              className="bg-page border-2 border-success rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
            />
          </>
        ) : (
          <MoneyInput
            name="revenue"
            required
            placeholder="Summa"
            className="bg-page border-2 border-success rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
          />
        )}

        <input
          name="note"
          placeholder="Izoh (zakaz bo'lsa: qayerga, kimga)"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-success"
        />

        <button type="submit" className="bg-success text-white rounded-xl py-3 font-extrabold text-sm">
          Saqlash ✓
        </button>
      </form>
    </div>
  );
}
