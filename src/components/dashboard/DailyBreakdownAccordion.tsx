"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatSom, formatDayMonth } from "@/lib/format";
import type { DailyBreakdownRow } from "@/lib/dashboard";

function Row({ row }: { row: DailyBreakdownRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-row-divider first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-page transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`text-muted-2 text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <span className="text-[13px] font-extrabold text-heading whitespace-nowrap">
            {formatDayMonth(row.date)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[13px] font-bold flex-wrap justify-end">
          <span className="text-success">+{formatSom(row.totalIncome)}</span>
          <span className="text-danger">−{formatSom(row.totalExpense)}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-page rounded-xl p-3.5 flex flex-col gap-1.5">
              <div className="text-[11px] text-muted-2 font-bold uppercase">Қува</div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-2 font-semibold">Тушум</span>
                <span className="font-extrabold text-success">{formatSom(row.quvaIncome)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-2 font-semibold">Чиқим</span>
                <span className="font-extrabold text-danger">{formatSom(row.quvaExpense)}</span>
              </div>
            </div>
            <div className="bg-page rounded-xl p-3.5 flex flex-col gap-1.5">
              <div className="text-[11px] text-muted-2 font-bold uppercase">Фарғона</div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-2 font-semibold">Тушум</span>
                <span className="font-extrabold text-success">{formatSom(row.fargonaIncome)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-2 font-semibold">Чиқим</span>
                <span className="font-extrabold text-danger">{formatSom(row.fargonaExpense)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-extrabold text-heading">Умумий тушум</span>
              <span className="font-extrabold text-success">{formatSom(row.totalIncome)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-extrabold text-heading">Умумий чиқим</span>
              <span className="font-extrabold text-danger">{formatSom(row.totalExpense)}</span>
            </div>
          </div>

          {(row.advance > 0 || row.fine > 0 || row.outsideExpense > 0) && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-row-divider">
              {row.advance > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-2 font-semibold">Аванс</span>
                  <span className="font-bold text-heading">{formatSom(row.advance)}</span>
                </div>
              )}
              {row.fine > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-2 font-semibold">Жарима</span>
                  <span className="font-bold text-heading">{formatSom(row.fine)}</span>
                </div>
              )}
              {row.outsideExpense > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-2 font-semibold">Пунктдан ташқари чиқим</span>
                  <span className="font-bold text-heading">{formatSom(row.outsideExpense)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Accountant-only per-day ledger, one collapsible row per day within the
 * page's selected period — Quva/Fargona kirim-chiqim, their combined total,
 * plus advance/fine/outside-point expense as informational lines (not
 * folded into "total expense": a fine offsets payroll rather than being a
 * cash expense, and an advance is netted back out of salary later — see
 * computeCashBalance's own comment on the same distinction).
 */
export function DailyBreakdownAccordion({ rows, periodLabel }: { rows: DailyBreakdownRow[]; periodLabel: string }) {
  const [visible, setVisible] = useState(true);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-[18px] text-left"
      >
        <span className="font-heading font-bold text-base text-heading">Кунлик ҳисобот · {periodLabel}</span>
        <span className="text-primary text-xs font-extrabold hover:underline">
          {visible ? "Яшириш ▲" : "Кўрсатиш ▼"}
        </span>
      </button>
      {visible && (
        <div className="flex flex-col">
          {rows.map((row) => (
            <Row key={row.date.toISOString()} row={row} />
          ))}
        </div>
      )}
    </Card>
  );
}
