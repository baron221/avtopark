"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { addTripAction, addOtherIncomeAction, type TripReceipt } from "../actions";
import { OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import { formatSom } from "@/lib/format";
import type { Point, OtherIncomeCategory } from "@prisma/client";

type VehicleOption = { id: string; plate: string; driverName: string };
type Kind = "TRIP" | "ORDER" | "OTHER_INCOME";

const POINT_LABELS: Record<Point, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

/** Terminal (Sunmi P3) prints via the browser's own print dialog once the
 * client installs Sunmi App Market's "Sunmiprinterplugin", which intercepts
 * window.print() and routes it to the built-in thermal printer instead of
 * showing a normal print preview — no native app/SDK integration needed on
 * our side. #trip-receipt is hidden on screen and is the only thing the
 * @media print rule leaves visible, so printing the page prints just this. */
function TripReceiptPrint({ receipt }: { receipt: TripReceipt }) {
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #trip-receipt, #trip-receipt * { visibility: visible; }
          #trip-receipt {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 58mm;
            padding: 3mm;
          }
        }
      `}</style>
      <div id="trip-receipt" className="hidden font-mono text-[12px] leading-tight">
        <div className="text-center font-bold">Фарғона–Қува Автопарк</div>
        <div className="text-center">{POINT_LABELS[receipt.point]} пункти</div>
        <div>{"-".repeat(32)}</div>
        <div>{receipt.time.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        <div>Машина: {receipt.plate}</div>
        <div>Ҳайдовчи: {receipt.driverName}</div>
        {receipt.kind === "TRIP" ? (
          <div>{receipt.tripNumber ? `${receipt.tripNumber}-рейс` : "Рейс"} · {receipt.passengerCount} йўловчи</div>
        ) : (
          <div>Алоҳида заказ</div>
        )}
        <div>{"-".repeat(32)}</div>
        <div className="text-center font-bold text-[16px]">{formatSom(receipt.amount)} сўм</div>
      </div>
    </>
  );
}

export function IncomeForm({
  vehicles,
  baseFare,
  point,
  todayStr,
  monthStartStr,
  defaultDateStr,
  externalVehiclePlates,
}: {
  vehicles: VehicleOption[];
  baseFare: number;
  /** Set only for a granted non-Dispatcher visitor, who has no point of their own. */
  point?: Point;
  /** ISO yyyy-mm-dd — bounds for the backdate picker below. */
  todayStr: string;
  monthStartStr: string;
  /** ISO yyyy-mm-dd — the day new entries should land on, i.e. whichever
   * day the page itself is currently showing (see its own date picker).
   * Defaults to todayStr when the page is on today, same as before this
   * prop existed. When it differs from todayStr, the date picker below
   * starts already expanded, so it's obvious at a glance which day a new
   * entry will be recorded under. */
  defaultDateStr?: string;
  /** Known non-fleet payers (see ExternalVehicleManager) — offered as
   * autocomplete suggestions, not a closed list: a one-off payer never
   * added there must still be typeable. */
  externalVehiclePlates: string[];
}) {
  const router = useRouter();
  const initialDate = defaultDateStr ?? todayStr;
  const [kind, setKind] = useState<Kind>("TRIP");
  const [category, setCategory] = useState<OtherIncomeCategory>("BOSHQA");
  const [passengerCountText, setPassengerCountText] = useState("");
  const passengerCount = Number(passengerCountText) || 0;
  const [tripNumberText, setTripNumberText] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showDate, setShowDate] = useState(initialDate !== todayStr);
  const [dateValue, setDateValue] = useState(initialDate);
  const formRef = useRef<HTMLFormElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [receipt, setReceipt] = useState<TripReceipt | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      if (kind === "OTHER_INCOME") {
        await addOtherIncomeAction(formData);
      } else {
        const created = await addTripAction(formData);
        if (created) setReceipt(created);
      }
      router.refresh();
      formRef.current?.reset();
      setResetKey((k) => k + 1);
      setSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 2500);
    });
  }

  // Terminal (Sunmi P3) prints via window.print() — see TripReceiptPrint's
  // own comment. Fires once the receipt DOM has actually rendered, and
  // clears the receipt afterward so the next save doesn't re-print a stale
  // one if something else on the page triggers a print later.
  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => window.print(), 100);
    const clear = () => setReceipt(null);
    window.addEventListener("afterprint", clear);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", clear);
    };
  }, [receipt]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-success">+ Кирим киритиш</div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Ignored by addOtherIncomeAction when kind is OTHER_INCOME — only addTripAction reads this. */}
        <input type="hidden" name="kind" value={kind} />
        {point && <input type="hidden" name="point" value={point} />}
        {showDate ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateValue}
              min={monthStartStr}
              max={todayStr}
              onChange={(e) => setDateValue(e.target.value || todayStr)}
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-success"
            />
            {dateValue !== todayStr && <input type="hidden" name="date" value={dateValue} />}
            <button
              type="button"
              onClick={() => {
                setShowDate(false);
                setDateValue(initialDate);
              }}
              className="text-muted-2 text-xs font-bold hover:text-danger"
            >
              {initialDate === todayStr ? "Бугунга қайтариш" : "Аслига қайтариш"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className="text-primary text-xs font-extrabold hover:underline self-start"
          >
            Санани ўзгартириш
          </button>
        )}
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
              name="plateNumber"
              list="external-vehicle-plates"
              autoComplete="off"
              placeholder="Машина рақами (масалан: 40 296 RCA)"
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-success"
            />
            <datalist id="external-vehicle-plates">
              {externalVehiclePlates.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <input
              name="note"
              placeholder="Изоҳ (ихтиёрий)"
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
      {receipt && <TripReceiptPrint receipt={receipt} />}
    </div>
  );
}
