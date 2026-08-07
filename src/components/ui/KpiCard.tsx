import { ReactNode } from "react";
import Link from "next/link";
import { Card } from "./Card";

export function KpiCard({
  label,
  value,
  hint,
  hintColor = "muted",
  variant = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintColor?: "success" | "danger" | "muted";
  variant?: "default" | "primary";
  /** When set, the whole card links there — e.g. a KPI drilling down into its breakdown. */
  href?: string;
}) {
  const isPrimary = variant === "primary";

  const hintColorClass = isPrimary
    ? "text-white"
    : hintColor === "success"
      ? "text-success"
      : hintColor === "danger"
        ? "text-danger"
        : "text-muted-2";

  const content = (
    <Card
      className={`p-5 ${isPrimary ? "bg-primary border-primary text-white" : ""} ${
        href ? "transition-transform hover:-translate-y-0.5 hover:shadow-lg" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`text-[13px] font-semibold ${isPrimary ? "text-white/80" : "text-muted-2"}`}>
          {label}
        </div>
        {href && <span className={`text-xs ${isPrimary ? "text-white/70" : "text-muted-2"}`}>→</span>}
      </div>
      <div className="font-heading text-[30px] font-bold mt-2">{value}</div>
      {hint && (
        <div
          className={`text-xs font-bold mt-2 ${hintColorClass} ${
            isPrimary ? "inline-block bg-white/20 px-2.5 py-0.5 rounded-full" : ""
          }`}
        >
          {hint}
        </div>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
