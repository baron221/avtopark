"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addFuelStationAction } from "./actions";

export function AddStationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card border border-border text-body rounded-2xl px-5 py-3 font-extrabold text-sm text-left hover:border-primary hover:text-primary transition-colors"
      >
        + Янги заправка қўшиш
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
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
        <input
          name="name"
          required
          placeholder="Номи (масалан: Quva Metan)"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        />
        <select
          name="fuelType"
          required
          defaultValue="METAN"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        >
          <option value="METAN">Газ (METAN)</option>
          <option value="BENZIN">Бензин</option>
          <option value="DIZEL">Дизель</option>
        </select>
        <input
          name="contractNo"
          required
          placeholder="Шартнома рақами"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        />
        <MoneyInput
          name="unitPrice"
          required
          placeholder="Бир литр/м³ нархи"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        />
        <select
          name="payPeriod"
          required
          defaultValue="HALF_MONTH"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        >
          <option value="WEEK">Ҳафталик тўлов</option>
          <option value="HALF_MONTH">Ойнинг ярмида тўлов</option>
          <option value="MONTH">Ойлик тўлов</option>
        </select>
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
    </div>
  );
}
