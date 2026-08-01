"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addStaffExpenseAction, addLunchAction } from "../actions";
import type { Point } from "@prisma/client";

const CATEGORIES = [
  { value: "STOYANKA", label: "Stoyanka" },
  { value: "OZIQ_OVQAT", label: "Shaxsiy oziq-ovqat" },
  { value: "OBED", label: "Obed" },
  { value: "BOSHQA", label: "Boshqa rasxod" },
];

export function ExpenseForm({ point }: { point?: Point }) {
  const router = useRouter();
  const [category, setCategory] = useState("STOYANKA");
  const isLunch = category === "OBED";
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const action = isLunch ? addLunchAction : addStaffExpenseAction;
    startTransition(async () => {
      await action(formData);
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
      <div className="font-heading font-bold text-[15px] text-danger">− Chiqim kiritish</div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        {point && <input type="hidden" name="point" value={point} />}
        {!isLunch && <input type="hidden" name="category" value={category} />}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3.5 py-2 text-[13px] font-extrabold ${
                category === c.value ? "bg-danger text-white" : "bg-page border-2 border-border text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <MoneyInput
          name="amount"
          required
          placeholder="Summa"
          key={resetKey}
          className="bg-page border-2 border-danger rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
        />
        {!isLunch && (
          <input
            name="note"
            placeholder="Izoh"
            className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-danger"
          />
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-danger text-white rounded-xl py-3 font-extrabold text-sm disabled:opacity-60"
        >
          {pending ? "Saqlanmoqda…" : "Saqlash ✓"}
        </button>
        {saved && (
          <div className="flex items-center justify-center gap-1.5 text-danger font-extrabold text-[13px]">
            <span>✓</span> Kiritildi
          </div>
        )}
      </form>
    </div>
  );
}
