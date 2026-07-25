import { ReactNode } from "react";
import { Card } from "./Card";

export function KpiCard({
  label,
  value,
  hint,
  hintColor = "muted",
  variant = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintColor?: "success" | "danger" | "muted";
  variant?: "default" | "primary";
}) {
  const isPrimary = variant === "primary";

  const hintColorClass = isPrimary
    ? "text-white"
    : hintColor === "success"
      ? "text-success"
      : hintColor === "danger"
        ? "text-danger"
        : "text-muted-2";

  return (
    <Card
      className={`p-5 ${isPrimary ? "bg-primary border-primary text-white" : ""}`}
    >
      <div className={`text-[13px] font-semibold ${isPrimary ? "text-white/80" : "text-muted-2"}`}>
        {label}
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
}
