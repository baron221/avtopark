"use client";

import { useState } from "react";

/**
 * Snapshots the DOM node at `targetId` (rendered exactly as it currently
 * sits on screen — whatever CashBreakdown buckets happen to be expanded)
 * into a downloadable JPG. html2canvas is dynamically imported inside the
 * click handler so it never has to run during SSR.
 */
export function CashReportImageButton({ targetId }: { targetId: string }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    const target = document.getElementById(targetId);
    if (!target) return;

    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 2 });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `hisobot-${new Date().toISOString().slice(0, 10)}.jpg`;
      link.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="bg-card border border-border text-body text-xs font-extrabold px-3 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-colors whitespace-nowrap disabled:opacity-50"
    >
      {busy ? "Тайёрланмоқда…" : "🖼 Ҳисобот расм"}
    </button>
  );
}
