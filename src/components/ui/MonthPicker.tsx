"use client";

import { useRouter } from "next/navigation";

export function MonthPicker({
  basePath,
  value,
  paramName = "month",
  extraParams,
}: {
  basePath: string;
  value: string;
  /** Query param key to write the picked month to — defaults to "month". */
  paramName?: string;
  /** Any other filters (e.g. a period toggle on the same page) to preserve. */
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
      type="month"
      defaultValue={value}
      max={new Date().toISOString().slice(0, 7)}
      onChange={(e) => {
        if (!e.target.value) return;
        router.push(`${basePath}?${paramName}=${e.target.value}${extra}`, { scroll: false });
      }}
      className="bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary"
    />
  );
}
