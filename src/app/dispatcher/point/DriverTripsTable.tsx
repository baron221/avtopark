"use client";

import { useState } from "react";
import Link from "next/link";
import { formatSom, formatTime } from "@/lib/format";
import { DeleteEntryButton } from "../journal/DeleteEntryButton";
import type { Point } from "@prisma/client";

export type TripDetail = { id: string; time: Date; label: string; amount: number; editHref: string };
export type DriverGroup = {
  driverId: string;
  driverName: string;
  plate: string;
  totalAmount: number;
  trips: TripDetail[];
};

export function DriverTripsTable({
  groups,
  deleteAction,
  deletePoint,
}: {
  groups: DriverGroup[];
  deleteAction: (formData: FormData) => Promise<void>;
  /** Set only for a granted non-Dispatcher visitor, who has no point of their own. */
  deletePoint?: Point;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(driverId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  }

  if (groups.length === 0) {
    return <p className="text-[13px] text-muted-2 px-6 py-4">Бугун ҳали ёзув йўқ</p>;
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_28px] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Ҳайдовчи</div>
          <div>Машина</div>
          <div>Рейслар</div>
          <div>Жами сумма</div>
          <div></div>
        </div>
        {groups.map((g) => {
          const isOpen = expanded.has(g.driverId);
          return (
            <div key={g.driverId} className="border-t border-row-divider">
              <button
                type="button"
                onClick={() => toggle(g.driverId)}
                className="w-full grid grid-cols-[1.2fr_1fr_0.8fr_1fr_28px] gap-1 px-6 py-3 items-center text-sm text-left hover:bg-page transition-colors"
              >
                <div className="font-semibold text-heading">{g.driverName}</div>
                <div className="font-extrabold text-primary font-heading">{g.plate}</div>
                <div className="font-bold text-muted-2">{g.trips.length} та</div>
                <div className="font-extrabold text-heading">{formatSom(g.totalAmount)}</div>
                <div className={`text-muted-2 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</div>
              </button>
              {isOpen && (
                <div className="bg-page/60">
                  {g.trips.map((t) => (
                    <div
                      key={t.id}
                      className="grid grid-cols-[0.6fr_1fr_1fr_1fr_48px] gap-1 px-6 py-2.5 border-t border-row-divider items-center text-sm"
                    >
                      <div className="text-muted-2 font-bold">{formatTime(t.time)}</div>
                      <div className="col-span-2">
                        <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-success-tint text-success">
                          {t.label}
                        </span>
                      </div>
                      <div className="font-extrabold text-heading">{formatSom(t.amount)}</div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={t.editHref}
                          title="Таҳрирлаш"
                          className="text-muted-2 hover:text-primary text-base leading-none px-1"
                        >
                          ✎
                        </Link>
                        <DeleteEntryButton action={deleteAction} id={t.id} point={deletePoint} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="flex flex-col lg:hidden">
        {groups.map((g) => {
          const isOpen = expanded.has(g.driverId);
          return (
            <div key={g.driverId} className="border-t border-row-divider first:border-t-0">
              <button
                type="button"
                onClick={() => toggle(g.driverId)}
                className="w-full flex justify-between items-center gap-2 px-5 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-heading text-sm">{g.driverName}</div>
                  <div className="font-extrabold text-primary font-heading text-sm">{g.plate}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="font-extrabold text-heading text-sm">{formatSom(g.totalAmount)}</div>
                    <div className="text-muted-2 text-xs font-bold">{g.trips.length} та рейс</div>
                  </div>
                  <span className={`text-muted-2 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                </div>
              </button>
              {isOpen && (
                <div className="bg-page/60 pb-1">
                  {g.trips.map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-center gap-2 px-5 py-2 border-t border-row-divider text-[13px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-2 font-bold shrink-0">{formatTime(t.time)}</span>
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-success-tint text-success truncate">
                          {t.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-extrabold text-heading">{formatSom(t.amount)}</span>
                        <Link
                          href={t.editHref}
                          title="Таҳрирлаш"
                          className="text-muted-2 hover:text-primary text-base leading-none px-1"
                        >
                          ✎
                        </Link>
                        <DeleteEntryButton action={deleteAction} id={t.id} point={deletePoint} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
