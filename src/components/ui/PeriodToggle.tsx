import Link from "next/link";

const OPTIONS = [
  { value: "DAY", label: "Кун" },
  { value: "WEEK", label: "Ҳафта" },
  { value: "MONTH", label: "Ой" },
] as const;

export function PeriodToggle({
  active,
  basePath,
  date,
  extraParams,
}: {
  active: string;
  basePath: string;
  /** Carried along so switching Kun/Ҳафта/Ой doesn't reset a picked date. */
  date?: string;
  /** Any other filters (e.g. point) to preserve across period switches. */
  extraParams?: Record<string, string>;
}) {
  const extra = extraParams
    ? Object.entries(extraParams)
        .map(([k, v]) => `&${k}=${v}`)
        .join("")
    : "";
  return (
    <div className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={`${basePath}?period=${opt.value}${date ? `&date=${date}` : ""}${extra}`}
          scroll={false}
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
