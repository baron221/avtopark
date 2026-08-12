"use client";

import { useState, type ReactNode } from "react";
import { formatSom, formatDayMonth, formatTime } from "@/lib/format";
import type {
  TodayCashDetail,
  TripIncomeDetailRow,
  OtherIncomeDetailRow,
  PointExpenseDetailRow,
  OutsideExpenseDetailRow,
} from "@/lib/ownerPayout";

const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

function Bucket({
  label,
  total,
  count,
  amountColor,
  children,
}: {
  label: string;
  total: number;
  count: number;
  amountColor: "success" | "danger";
  children: ReactNode;
}) {
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
        <span
          className={`text-[13px] font-extrabold whitespace-nowrap ${amountColor === "success" ? "text-success" : "text-danger"}`}
        >
          {formatSom(total)}
        </span>
      </button>
      {open && <div className="pl-4 pb-2 flex flex-col gap-1">{children}</div>}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-2 py-1">Ёзув йўқ</p>;
}

function TripRow({ r }: { r: TripIncomeDetailRow }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-1 border-t border-row-divider first:border-t-0">
      <div className="min-w-0">
        <div className="text-muted-2 font-semibold">
          {formatDayMonth(r.time)} · {formatTime(r.time)} ·{" "}
          <span className="text-[10px]">{r.kind === "ORDER" ? "Заказ" : "Рейс"}</span>
        </div>
        <div className="text-body font-semibold">
          {r.vehiclePlate} · {r.driverName}
          {r.note && <span className="text-muted-2"> · {r.note}</span>}
        </div>
      </div>
      <span className="font-bold text-success whitespace-nowrap">{formatSom(r.amount)}</span>
    </div>
  );
}

function OtherIncomeRow({ r }: { r: OtherIncomeDetailRow }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-1 border-t border-row-divider first:border-t-0">
      <div className="min-w-0">
        <div className="text-muted-2 font-semibold">
          {formatDayMonth(r.time)} · {formatTime(r.time)} · {POINT_LABELS[r.point] ?? r.point}
        </div>
        <div className="text-body font-semibold">
          {r.category}
          {r.plateNumber && <span className="text-muted-2"> · {r.plateNumber}</span>}
          {r.note && <span className="text-muted-2"> · {r.note}</span>}
          <span className="text-muted-2"> · {r.enteredByName}</span>
        </div>
      </div>
      <span className="font-bold text-success whitespace-nowrap">{formatSom(r.amount)}</span>
    </div>
  );
}

function PointExpenseRow({ r }: { r: PointExpenseDetailRow }) {
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

function OutsideExpenseRow({ r }: { r: OutsideExpenseDetailRow }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-1 border-t border-row-divider first:border-t-0">
      <div className="min-w-0">
        <div className="text-muted-2 font-semibold">
          {formatDayMonth(r.time)} · {formatTime(r.time)}
        </div>
        <div className="text-body font-semibold">
          {r.category} · {r.vehiclePlate}
          {r.note && <span className="text-muted-2"> · {r.note}</span>}
        </div>
      </div>
      <span className="font-bold text-danger whitespace-nowrap">−{formatSom(r.amount)}</span>
    </div>
  );
}

function Tile({
  label,
  total,
  color,
  children,
}: {
  label: string;
  total: number;
  color: "success" | "danger";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-page rounded-xl p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-2 font-bold uppercase">{label}</div>
          <span className={`text-muted-2 text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        </div>
        <div
          className={`font-heading font-extrabold text-lg ${color === "success" ? "text-success" : "text-danger"}`}
        >
          {formatSom(total)}
        </div>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

/**
 * The cash card's two "today" KPI tiles, made clickable — each opens into a
 * Fargona/Quva/"other" breakdown, and each of those into the individual
 * trip/expense records behind it. Two levels deep, both collapsed by
 * default: neither level's text (locale-formatted dates/times included) is
 * ever part of the initial SSR/hydration pass, so it can't cause the kind
 * of hydration mismatch DailyBreakdownAccordion's date label hit earlier.
 */
export function TodayCashBreakdown({ detail }: { detail: TodayCashDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label="Умумий кунлик тушум" total={detail.income.total} color="success">
        <Bucket
          label="Фарғона"
          total={detail.income.fargona.total}
          count={detail.income.fargona.rows.length}
          amountColor="success"
        >
          {detail.income.fargona.rows.length === 0 ? (
            <Empty />
          ) : (
            detail.income.fargona.rows.map((r) => <TripRow key={r.id} r={r} />)
          )}
        </Bucket>
        <Bucket
          label="Қува"
          total={detail.income.quva.total}
          count={detail.income.quva.rows.length}
          amountColor="success"
        >
          {detail.income.quva.rows.length === 0 ? (
            <Empty />
          ) : (
            detail.income.quva.rows.map((r) => <TripRow key={r.id} r={r} />)
          )}
        </Bucket>
        <Bucket
          label="Бошқа кирим"
          total={detail.income.other.total}
          count={detail.income.other.rows.length}
          amountColor="success"
        >
          {detail.income.other.rows.length === 0 ? (
            <Empty />
          ) : (
            detail.income.other.rows.map((r) => <OtherIncomeRow key={r.id} r={r} />)
          )}
        </Bucket>
      </Tile>

      <Tile label="Умумий кунлик расход" total={detail.expense.total} color="danger">
        <Bucket
          label="Фарғона"
          total={detail.expense.fargona.total}
          count={detail.expense.fargona.rows.length}
          amountColor="danger"
        >
          {detail.expense.fargona.rows.length === 0 ? (
            <Empty />
          ) : (
            detail.expense.fargona.rows.map((r) => <PointExpenseRow key={r.id} r={r} />)
          )}
        </Bucket>
        <Bucket
          label="Қува"
          total={detail.expense.quva.total}
          count={detail.expense.quva.rows.length}
          amountColor="danger"
        >
          {detail.expense.quva.rows.length === 0 ? (
            <Empty />
          ) : (
            detail.expense.quva.rows.map((r) => <PointExpenseRow key={r.id} r={r} />)
          )}
        </Bucket>
        <Bucket
          label="Бошқа чиқимлар"
          total={detail.expense.outside.total}
          count={detail.expense.outside.rows.length}
          amountColor="danger"
        >
          {detail.expense.outside.rows.length === 0 ? (
            <Empty />
          ) : (
            detail.expense.outside.rows.map((r) => <OutsideExpenseRow key={r.id} r={r} />)
          )}
        </Bucket>
      </Tile>
    </div>
  );
}
