"use client";

import { useRouter } from "next/navigation";

export function MonthPicker({ basePath, value }: { basePath: string; value: string }) {
  const router = useRouter();

  return (
    <input
      type="month"
      defaultValue={value}
      max={new Date().toISOString().slice(0, 7)}
      onChange={(e) => {
        if (!e.target.value) return;
        router.push(`${basePath}?month=${e.target.value}`, { scroll: false });
      }}
      className="bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary"
    />
  );
}
