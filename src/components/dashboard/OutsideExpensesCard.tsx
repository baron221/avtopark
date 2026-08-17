"use client";

import { useState, type ReactNode } from "react";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { formatSom, formatDayMonth, formatTime } from "@/lib/format";
import type { CashDetail, PointExpenseDetailRow, OutsideExpenseDetailRow } from "@/lib/ownerPayout";

function Bucket({ label, total, count, children }: { label: string; total: number; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-row-divider first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 text-left"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-muted-2 text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <span className="text-[13px] font-bold text-heading truncate">{label}</span>
          <span className="text-[11px] text-muted-2 font-semibold whitespace-nowrap">({count})</span>
        </div>
        <span className="text-[13px] font-extrabold text-danger whitespace-nowrap">−{formatSom(total)}</span>
      </button>
      {open && <div className="pl-4 pb-2 flex flex-col gap-1">{children}</div>}
    </div>
  );
}

function PointRow({ r }: { r: PointExpenseDetailRow }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-1 border-t border-row-divider first:border-t-0">
      <div className="min-w-0">
        <div className="text-muted-2 font-semibold">
          {formatDayMonth(r.time)} · {formatTime(r.time)}
        </div>
        <div className="text-body font-semibold">
          {r.category} · {r.personName}
          {r.note && <span className="text-muted-2"> · {r.note}</span>}
        </div>
      </div>
      <span className="font-bold text-danger whitespace-nowrap">−{formatSom(r.amount)}</span>
    </div>
  );
}

function OutsideRow({ r }: { r: OutsideExpenseDetailRow }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-1 border-t border-row-divider first:border-t-0">
      <div className="min-w-0">
        <div className="text-muted-2 font-semibold">
          {formatDayMonth(r.time)} · {formatTime(r.time)}
        </div>
        <div className="text-body font-semibold">
          {r.category} · {r.subtitle}
          {r.note && <span className="text-muted-2"> · {r.note}</span>}
        </div>
      </div>
      <span className="font-bold text-danger whitespace-nowrap">−{formatSom(r.amount)}</span>
    </div>
  );
}

/** Full daily-expense drill-down (Фарғона/Қува point spend + everything not
 * tied to a point) in one collapsible card — the same breakdown the cash
 * card's "Умумий {period} расход" tile already shows, surfaced here too so
 * it sits right under the two point cards instead of only further down the
 * page. Collapsed by default, same as the per-point vehicle listings. */
export function OutsideExpensesCard({ detail }: { detail: CashDetail }) {
  if (detail.expense.total === 0) return null;

  return (
    <CollapsibleCard
      title={
        <div className="flex items-center justify-between flex-1 gap-3 min-w-0">
          <div className="min-w-0">
            <div className="font-heading font-bold text-base text-heading truncate">
              Бошқа чиқимлар · {detail.periodWord}
            </div>
            <div className="text-xs text-danger font-bold mt-0.5 whitespace-nowrap">
              −{formatSom(detail.expense.outside.total)} · {detail.expense.outside.rows.length} та ёзув
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-muted-2 font-bold uppercase whitespace-nowrap">
              Умумий {detail.periodWord.toLowerCase()} расход
            </div>
            <div className="font-heading font-extrabold text-base text-danger">
              −{formatSom(detail.expense.total)}
            </div>
          </div>
        </div>
      }
    >
      <div className="px-5 pb-4 flex flex-col">
        <Bucket label="Фарғона" total={detail.expense.fargona.total} count={detail.expense.fargona.rows.length}>
          {detail.expense.fargona.rows.map((r) => (
            <PointRow key={r.id} r={r} />
          ))}
        </Bucket>
        <Bucket label="Қува" total={detail.expense.quva.total} count={detail.expense.quva.rows.length}>
          {detail.expense.quva.rows.map((r) => (
            <PointRow key={r.id} r={r} />
          ))}
        </Bucket>
        <Bucket label="Бошқа чиқимлар" total={detail.expense.outside.total} count={detail.expense.outside.rows.length}>
          {detail.expense.outside.rows.map((r) => (
            <OutsideRow key={r.id} r={r} />
          ))}
        </Bucket>
      </div>
    </CollapsibleCard>
  );
}
