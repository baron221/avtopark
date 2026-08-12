"use client";

import { useRouter } from "next/navigation";

export function DatePicker({
  basePath,
  period,
  value,
  min,
  extraParams,
}: {
  basePath: string;
  /** Omit for a page with no period concept (e.g. the dispatcher's own
   * day-view pages) — the query string just won't carry a period param. */
  period?: string;
  /** ISO yyyy-mm-dd */
  value: string;
  /** ISO yyyy-mm-dd — earliest selectable date, if bounded. */
  min?: string;
  /** Any other filters (e.g. point) to preserve when the date changes. */
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const extra = extraParams
    ? Object.entries(extraParams)
        .map(([k, v]) => `&${k}=${v}`)
        .join("")
    : "";

  return (
    <input
      type="date"
      defaultValue={value}
      min={min}
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e) => {
        if (!e.target.value) return;
        const periodPart = period ? `period=${period}&` : "";
        router.push(`${basePath}?${periodPart}date=${e.target.value}${extra}`, { scroll: false });
      }}
      className="bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary"
    />
  );
}
