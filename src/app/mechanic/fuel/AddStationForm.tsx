"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { addFuelStationAction, updateFuelStationAction, deleteFuelStationAction } from "./actions";

const FUEL_TYPE_LABELS: Record<string, string> = { METAN: "METAN", BENZIN: "БЕНЗИН", DIZEL: "ДИЗЕЛЬ" };

type StationRow = {
  id: string;
  name: string;
  fuelType: string;
  contractNo: string;
  unitPrice: number;
  payPeriod: string;
};

const fieldClass =
  "bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary";

/** Shared by both the "add new" and "edit existing" forms — same fields
 * either way, just pre-filled for edit (see updateFuelStationAction's own
 * comment on why editing exists: a real price increase used to have no way
 * to reach the app short of deleting and re-adding under a new id). */
function StationFields({ defaults }: { defaults?: StationRow }) {
  return (
    <>
      <input name="name" required defaultValue={defaults?.name} placeholder="Номи (масалан: Quva Metan)" className={fieldClass} />
      <select name="fuelType" required defaultValue={defaults?.fuelType ?? "METAN"} className={fieldClass}>
        <option value="METAN">Газ (METAN)</option>
        <option value="BENZIN">Бензин</option>
        <option value="DIZEL">Дизель</option>
      </select>
      <input name="contractNo" required defaultValue={defaults?.contractNo} placeholder="Шартнома рақами" className={fieldClass} />
      <MoneyInput name="unitPrice" required defaultValue={defaults?.unitPrice} placeholder="Бир литр/м³ нархи" className={fieldClass} />
      <select name="payPeriod" required defaultValue={defaults?.payPeriod ?? "HALF_MONTH"} className={fieldClass}>
        <option value="WEEK">Ҳафталик тўлов</option>
        <option value="HALF_MONTH">Ойнинг ярмида тўлов</option>
        <option value="MONTH">Ойлик тўлов</option>
      </select>
    </>
  );
}

export function AddStationForm({ stations }: { stations: StationRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-heading">Заправкалар ({stations.length})</div>
      <div className="flex flex-col gap-1">
        {stations.map((s) =>
          editingId === s.id ? (
            <form
              key={s.id}
              action={(formData) => {
                startTransition(async () => {
                  await updateFuelStationAction(formData);
                  router.refresh();
                  setEditingId(null);
                });
              }}
              className="flex flex-col gap-2 bg-page rounded-lg p-3"
            >
              <input type="hidden" name="id" value={s.id} />
              <StationFields defaults={s} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="flex-1 bg-card border-2 border-border text-muted rounded-lg py-2 font-extrabold text-xs"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 bg-primary text-white rounded-lg py-2 font-extrabold text-xs disabled:opacity-60"
                >
                  {pending ? "Сақланмоқда…" : "Сақлаш ✓"}
                </button>
              </div>
            </form>
          ) : (
            <div key={s.id} className="flex items-center justify-between gap-2 bg-page rounded-lg px-3 py-2">
              <span className="text-sm font-bold text-heading">
                {s.name} · {FUEL_TYPE_LABELS[s.fuelType] ?? s.fuelType}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Таҳрирлаш"
                  onClick={() => setEditingId(s.id)}
                  className="text-muted-2 hover:text-primary text-base leading-none px-1"
                >
                  ✎
                </button>
                <ConfirmDeleteButton
                  action={deleteFuelStationAction}
                  id={s.id}
                  confirmText="Бу заправкани ўчиришни тасдиқлайсизми?"
                  className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1"
                />
              </div>
            </div>
          )
        )}
        {stations.length === 0 && <p className="text-xs text-muted-2 px-1">Ҳали йўқ</p>}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-page border border-border text-body rounded-xl px-4 py-2.5 font-extrabold text-sm text-left hover:border-primary hover:text-primary transition-colors"
        >
          + Янги заправка қўшиш
        </button>
      ) : (
        <>
          <div className="font-heading font-bold text-[15px] text-heading">+ Янги заправка</div>
          <form
            ref={formRef}
            action={(formData) => {
              startTransition(async () => {
                await addFuelStationAction(formData);
                router.refresh();
                formRef.current?.reset();
                setOpen(false);
              });
            }}
            className="flex flex-col gap-3"
          >
            <StationFields />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 bg-page border-2 border-border text-muted rounded-xl py-2.5 font-extrabold text-sm"
              >
                Бекор қилиш
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 font-extrabold text-sm disabled:opacity-60"
              >
                {pending ? "Сақланмоқда…" : "Сақлаш ✓"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
