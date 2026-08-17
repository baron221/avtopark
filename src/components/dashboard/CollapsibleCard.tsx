"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/** A Card that starts collapsed and opens on click — for long listings
 * (e.g. per-vehicle tables) that take a lot of vertical space but aren't
 * needed on every page view. */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        {title}
        <span className="text-primary text-xs font-extrabold whitespace-nowrap">
          {open ? "Яшириш ▲" : "Кўрсатиш ▼"}
        </span>
      </button>
      {open && children}
    </Card>
  );
}
