"use client";

import { addLunchAction } from "../actions";

const DEFAULT_LUNCH_AMOUNT = 12_000;

export function LunchForm() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-warning">Obed</div>
      <form action={addLunchAction} className="flex gap-2">
        <input
          name="amount"
          type="number"
          min={1}
          defaultValue={DEFAULT_LUNCH_AMOUNT}
          placeholder="Summa"
          className="flex-1 bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-heading outline-none focus:border-warning"
        />
        <button type="submit" className="bg-warning text-white rounded-xl px-4 font-extrabold text-sm">
          Saqlash ✓
        </button>
      </form>
    </div>
  );
}
