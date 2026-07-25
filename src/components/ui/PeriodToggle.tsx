import Link from "next/link";

const OPTIONS = [
  { value: "DAY", label: "Kun" },
  { value: "WEEK", label: "Hafta" },
  { value: "MONTH", label: "Oy" },
] as const;

export function PeriodToggle({ active, basePath }: { active: string; basePath: string }) {
  return (
    <div className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={`${basePath}?period=${opt.value}`}
          className={`px-[18px] py-[7px] rounded-lg text-[13px] font-bold ${
            active === opt.value ? "bg-primary text-white" : "text-muted"
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
