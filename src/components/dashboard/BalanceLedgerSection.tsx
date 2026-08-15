"use client";

import { useState } from "react";
import { formatSom, formatDayMonth, formatTime } from "@/lib/format";
import type { BalanceLedgerRow } from "@/lib/ownerPayout";

/**
 * Full reconciliation ledger behind the balance figure — every addition
 * (confirmed handovers) and deduction (every expense/advance/salary/station
 * payment category) since the opening balance was set, in time order, so a
 * discrepancy against a physical cash count can be tracked entry by entry.
 * Collapsed by default: this can run to dozens of rows once the opening
 * balance has been standing a while.
 */
export function BalanceLedgerSection({
  rows,
  openingBalance,
}: {
  rows: BalanceLedgerRow[];
  openingBalance: { amount: number; setDate: Date };
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-card border border-border text-body text-xs font-extrabold px-3 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
      >
        {open ? "Қолдиқ тарихини яшириш ▲" : `Қолдиқ тарихини кўрсатиш (${rows.length}) ▼`}
      </button>
      {open && (
        <div className="mt-2 flex flex-col max-h-[420px] overflow-y-auto">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-2 py-1.5 border-t border-row-divider first:border-t-0 text-xs"
            >
              <div className="min-w-0">
                <div className="text-muted-2 font-semibold">
                  {r.forDate ? (
                    <>
                      {formatDayMonth(r.forDate)} куни учун · тасдиқланди: {formatDayMonth(r.time)} ·{" "}
                      {formatTime(r.time)}
                    </>
                  ) : (
                    <>
                      {formatDayMonth(r.time)} · {formatTime(r.time)}
                    </>
                  )}{" "}
                  · {r.category}
                </div>
                <div className="text-body font-semibold">{r.subtitle}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-bold whitespace-nowrap ${r.sign === "IN" ? "text-success" : "text-danger"}`}>
                  {r.sign === "IN" ? "+" : "−"}
                  {formatSom(r.amount)}
                </div>
                <div className="text-[11px] text-muted-2 font-semibold whitespace-nowrap">
                  қолдиқ: {formatSom(r.balanceAfter)}
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 py-1.5 border-t border-row-divider text-xs">
            <div className="text-muted-2 font-semibold">
              {formatDayMonth(openingBalance.setDate)} · Бошланғич қолдиқ
            </div>
            <div className="font-bold text-heading whitespace-nowrap">{formatSom(openingBalance.amount)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
