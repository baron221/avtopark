"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [kind, setKind] = useState<"TRIP" | "ORDER">("TRIP");
  const [passengerCountText, setPassengerCountText] = useState("10");
  const passengerCount = Number(passengerCountText) || 0;
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addTripAction(formData);
      router.refresh();
      formRef.current?.reset();
      setResetKey((k) => k + 1);
      setSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-success">+ Кирим киритиш</div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            Рейс
          </button>
          <button
            type="button"
            onClick={() => setKind("ORDER")}
            className={`flex-1 rounded-[10px] py-2.5 text-center font-extrabold text-[13px] ${
              kind === "ORDER" ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            Алоҳида заказ
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
              inputMode="numeric"
              min={1}
              value={passengerCountText}
              onChange={(e) => setPassengerCountText(e.target.value)}
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-success"
              placeholder="Йўловчилар сони"
            />
            <MoneyInput
              name="revenue"
              defaultValue={passengerCount * baseFare}
              key={`trip-${passengerCount}-${resetKey}`}
              className="bg-page border-2 border-success rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
            />
          </>
        ) : (
          <MoneyInput
            name="revenue"
            required
            placeholder="Сумма"
            key={`order-${resetKey}`}
            className="bg-page border-2 border-success rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
          />
        )}

        <input
          name="note"
          placeholder="Изоҳ (заказ бўлса: қаерга, кимга)"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-success"
        />

        <button
          type="submit"
          disabled={pending}
          className="bg-success text-white rounded-xl py-3 font-extrabold text-sm disabled:opacity-60"
        >
          {pending ? "Сақланмоқда…" : "Сақлаш ✓"}
        </button>
        {saved && (
          <div className="flex items-center justify-center gap-1.5 text-success font-extrabold text-[13px]">
            <span>✓</span> Киритилди
          </div>
        )}
      </form>
    </div>
  );
}
