"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { addTripAction, addOtherIncomeAction } from "../actions";
import { OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import type { Point, OtherIncomeCategory } from "@prisma/client";

type VehicleOption = { id: string; plate: string; driverName: string };
type Kind = "TRIP" | "ORDER" | "OTHER_INCOME";

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
  const [kind, setKind] = useState<Kind>("TRIP");
  const [category, setCategory] = useState<OtherIncomeCategory>("BOSHQA");
  const [passengerCountText, setPassengerCountText] = useState("");
  const passengerCount = Number(passengerCountText) || 0;
  const [tripNumberText, setTripNumberText] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      if (kind === "OTHER_INCOME") {
        await addOtherIncomeAction(formData);
      } else {
        await addTripAction(formData);
      }
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
        {/* Ignored by addOtherIncomeAction when kind is OTHER_INCOME — only addTripAction reads this. */}
        <input type="hidden" name="kind" value={kind} />
        {point && <input type="hidden" name="point" value={point} />}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setKind("TRIP")}
            className={`rounded-[10px] py-2.5 text-center font-extrabold text-[12px] ${
              kind === "TRIP" ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            Рейс
          </button>
          <button
            type="button"
            onClick={() => setKind("ORDER")}
            className={`rounded-[10px] py-2.5 text-center font-extrabold text-[12px] ${
              kind === "ORDER" ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            Алоҳида заказ
          </button>
          <button
            type="button"
            onClick={() => setKind("OTHER_INCOME")}
            className={`rounded-[10px] py-2.5 text-center font-extrabold text-[12px] ${
              kind === "OTHER_INCOME" ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            Бошқа кирим
          </button>
        </div>

        {kind === "OTHER_INCOME" ? (
          <>
            {/* No vehicle picker here — this is cash from a vehicle outside
                the company's own fleet, so it isn't in the vehicle list at all. */}
            <input type="hidden" name="category" value={category} />
            <div className="flex flex-wrap gap-1.5">
              {OTHER_INCOME_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-lg px-3 py-1.5 text-center font-extrabold text-xs ${
                    category === c ? "bg-success text-white" : "bg-page border-2 border-border text-muted"
                  }`}
                >
                  {OTHER_INCOME_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            <MoneyInput
              name="amount"
              placeholder="Сумма"
              key={`other-${resetKey}`}
              className="bg-page border-2 border-success rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
            />
            <input
              name="note"
              placeholder="Қайси машина/ким учун (мажбурий)"
              required
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-success"
            />
          </>
        ) : (
          <>
            <SearchableSelect
              key={`vehicle-${resetKey}`}
              name="vehicleId"
              placeholder="Машина рақами (масалан: 296)"
              options={vehicles.map((v) => ({
                id: v.id,
                label: `${v.plate} · ${v.driverName}`,
                searchText: `${v.plate} ${v.driverName}`,
              }))}
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-success"
            />

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
                <input
                  name="tripNumber"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={tripNumberText}
                  onChange={(e) => setTripNumberText(e.target.value)}
                  className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-success"
                  placeholder="Нечанчи рейс (ихтиёрий)"
                />
                <MoneyInput
                  name="revenue"
                  defaultValue={passengerCount > 0 ? passengerCount * baseFare : undefined}
                  placeholder="Сумма"
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
          </>
        )}

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
