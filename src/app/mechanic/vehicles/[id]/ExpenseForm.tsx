"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addVehicleExpenseAction } from "./actions";

const CATEGORIES = [
  { value: "FUEL", label: "Ёқилғи" },
  { value: "REPAIR", label: "Таъмирлаш" },
  { value: "INSURANCE", label: "Суғурта" },
  { value: "TAX", label: "Солиқ" },
  { value: "TOLL", label: "Йўл ҳақи" },
  { value: "OTHER", label: "Бошқа" },
];

export function ExpenseForm({ vehicleId }: { vehicleId: string }) {
  const [category, setCategory] = useState("REPAIR");

  return (
    <form action={addVehicleExpenseAction} className="flex flex-col gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="category" value={category} />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              category === c.value ? "bg-primary text-white" : "bg-page border-2 border-border text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <MoneyInput
          name="amount"
          required
          placeholder="Сумма"
          className="flex-1 bg-page border-2 border-primary rounded-xl px-3.5 py-2.5 font-heading text-base font-bold text-heading outline-none"
        />
        <input
          name="note"
          placeholder="Изоҳ"
          className="flex-1 bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-primary"
        />
        <button type="submit" className="bg-primary-tint text-primary rounded-xl px-4 font-extrabold text-sm">
          + Қўшиш
        </button>
      </div>
    </form>
  );
}
