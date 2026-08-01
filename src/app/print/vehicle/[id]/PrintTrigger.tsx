"use client";

import { useEffect } from "react";

// Auto-opens the browser's print dialog on load — from there the mechanic can
// print on paper or choose "Save as PDF". No PDF library involved, so
// Cyrillic text just works (the browser renders it natively, unlike pdf-lib's
// WinAnsi-only standard fonts).
export function PrintTrigger() {
  useEffect(() => {
    window.print();
  }, []);
  return null;
}
