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
export function BalanceLedgerSection({ rows }: { rows: BalanceLedgerRow[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-primary text-xs font-extrabold hover:underline"
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
              <span className={`font-bold whitespace-nowrap ${r.sign === "IN" ? "text-success" : "text-danger"}`}>
                {r.sign === "IN" ? "+" : "−"}
                {formatSom(r.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
