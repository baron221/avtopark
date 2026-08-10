"use client";

import { useRouter } from "next/navigation";
import { uzMonthName } from "@/lib/format";

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

  const [y, m] = value.split("-").map(Number);
  const label = `${uzMonthName(new Date(y, m - 1, 1))} ${y}`;

  // A bare `<input type="month">` renders its written month name in the
  // BROWSER's UI language, not the app's — on an English-locale browser
  // that shows "August 2026" sitting inside an otherwise all-Uzbek page,
  // which reads as broken/foreign. The native input still handles the
  // actual picking (native picker UI, keyboard support), it's just made
  // invisible and stacked over a label we control the language of.
  return (
    <div className="relative bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading flex items-center gap-1.5 focus-within:border-primary">
      <span aria-hidden>📅</span>
      <span>{label}</span>
      <input
        type="month"
        defaultValue={value}
        max={new Date().toISOString().slice(0, 7)}
        onChange={(e) => {
          if (!e.target.value) return;
          router.push(`${basePath}?${paramName}=${e.target.value}${extra}`, { scroll: false });
        }}
        aria-label="Ойни танлаш"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
