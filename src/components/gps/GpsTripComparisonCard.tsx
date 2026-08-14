"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatDayMonth } from "@/lib/format";
import type { GpsTripComparisonRow } from "@/lib/gpsTripComparison";

function diffBadge(gps: number, dispatcher: number) {
  const diff = gps - dispatcher;
  if (diff === 0) return null;
  return (
    <span className="bg-danger-tint text-danger text-[10px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap">
      {diff > 0 ? `+${diff} GPS кўп` : `${-diff} диспетчер кўп`}
    </span>
  );
}

function VehicleRow({ row }: { row: GpsTripComparisonRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-row-divider first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full hidden lg:grid grid-cols-[auto_1fr_1.2fr_0.9fr_0.9fr_1.3fr] items-center gap-2 px-6 py-3.5 text-left hover:bg-page transition-colors"
      >
        <span className={`text-muted-2 text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        <span className="font-extrabold text-primary font-heading">{row.plate}</span>
        <span className="font-semibold text-heading">{row.driverName ?? "—"}</span>
        <span className="text-body font-bold">{row.totalGps} GPS</span>
        <span className="text-body font-bold">{row.totalDispatcher} диспетчер</span>
        <span className="justify-self-end">{diffBadge(row.totalGps, row.totalDispatcher)}</span>
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-col gap-2 p-4 text-left lg:hidden"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-muted-2 text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
            <div>
              <div className="font-extrabold text-primary font-heading">{row.plate}</div>
              <div className="text-xs text-heading font-semibold mt-0.5">{row.driverName ?? "—"}</div>
            </div>
          </div>
          {diffBadge(row.totalGps, row.totalDispatcher)}
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-row-divider text-xs">
          <span className="text-muted-2 font-semibold">GPS: {row.totalGps}</span>
          <span className="text-muted-2 font-semibold">Диспетчер: {row.totalDispatcher}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 flex flex-col gap-1.5 bg-page/50">
          {row.days.map((d) => (
            <div
              key={d.date.toISOString()}
              className="flex items-center justify-between gap-3 px-1 py-1.5 text-[13px]"
            >
              <span className="font-bold text-heading whitespace-nowrap">{formatDayMonth(d.date)}</span>
              <div className="flex items-center gap-3 font-bold">
                <span className="text-body">{d.gpsCount} GPS</span>
                <span className="text-body">{d.dispatcherCount} диспетчер</span>
                {d.hasOrder ? (
                  <span className="bg-page border border-border text-muted-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    буюртма куни
                  </span>
                ) : (
                  diffBadge(d.gpsCount, d.dispatcherCount)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Audit-only comparison: GPS-detected Farg'ona<->Quva station transits vs
 * dispatcher-entered Trip records, per vehicle over the last 7 days. Never
 * modifies Trip data — flags mismatches for someone to look into.
 */
export function GpsTripComparisonCard({
  rows,
  windowLabel = "сўнгги 7 кун",
}: {
  rows: GpsTripComparisonRow[];
  /** Overrides the default "last 7 days" heading when the window instead
   * follows a specific selected date (see uptoDateStr on getGpsTripComparisonRows). */
  windowLabel?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-3.5">
        <div className="font-heading font-bold text-base text-heading">GPS ва диспетчер рейслари · {windowLabel}</div>
        <div className="text-xs text-muted-2 font-semibold mt-0.5">
          Вокзаллар оралиғидаги GPS ҳаракатлари диспетчер кирган рейслар билан солиштирилади
        </div>
      </div>
      <div className="hidden lg:grid grid-cols-[auto_1fr_1.2fr_0.9fr_0.9fr_1.3fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
        <div />
        <div>Машина</div>
        <div>Ҳайдовчи</div>
        <div>GPS</div>
        <div>Диспетчер</div>
        <div />
      </div>
      {rows.map((row) => (
        <VehicleRow key={row.vehicleId} row={row} />
      ))}
    </Card>
  );
}
