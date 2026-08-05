"use client";

import { useRouter } from "next/navigation";

export function DatePicker({
  basePath,
  period,
  value,
}: {
  basePath: string;
  period: string;
  /** ISO yyyy-mm-dd */
  value: string;
}) {
  const router = useRouter();

  return (
    <input
      type="date"
      defaultValue={value}
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e) => {
        if (!e.target.value) return;
        router.push(`${basePath}?period=${period}&date=${e.target.value}`, { scroll: false });
      }}
      className="bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary"
    />
  );
}
