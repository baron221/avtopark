import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-card border border-border rounded-2xl shadow-[0_12px_40px_rgba(30,31,43,.14)] ${className}`}
      {...props}
    />
  );
}
