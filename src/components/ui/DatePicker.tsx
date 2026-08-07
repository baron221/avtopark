"use client";

import { useRouter } from "next/navigation";

export function DatePicker({
  basePath,
  period,
  value,
  extraParams,
}: {
  basePath: string;
  period: string;
  /** ISO yyyy-mm-dd */
  value: string;
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
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e) => {
        if (!e.target.value) return;
        router.push(`${basePath}?period=${period}&date=${e.target.value}${extra}`, { scroll: false });
      }}
      className="bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary"
    />
  );
}
