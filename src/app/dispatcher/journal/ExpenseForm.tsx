"use client";

import { useState } from "react";
import { addStaffExpenseAction } from "../actions";

const CATEGORIES = [
  { value: "STOYANKA", label: "Stoyanka" },
  { value: "OZIQ_OVQAT", label: "Shaxsiy oziq-ovqat" },
  { value: "BOSHQA", label: "Boshqa rasxod" },
];

export function ExpenseForm() {
  const [category, setCategory] = useState("STOYANKA");

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-danger">− Chiqim kiritish</div>
      <form action={addStaffExpenseAction} className="flex flex-col gap-3">
        <input type="hidden" name="category" value={category} />
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
        <input
          name="amount"
          type="number"
          required
          min={1}
          placeholder="Summa"
          className="bg-page border-2 border-danger rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
        />
        <input
          name="note"
          placeholder="Izoh"
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-danger"
        />
        <button type="submit" className="bg-danger text-white rounded-xl py-3 font-extrabold text-sm">
          Saqlash ✓
        </button>
      </form>
    </div>
  );
}
