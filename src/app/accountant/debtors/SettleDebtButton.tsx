"use client";

import { formatSom } from "@/lib/format";
import { settleTripDebtAction } from "./actions";

/** A plain <form action={...}> can't take an inline onSubmit from the
 * server-component page that renders it (Next.js forbids passing event
 * handlers as props across the server/client boundary) — same reason
 * ConfirmDeleteButton (components/ui) is its own "use client" file rather
 * than inline markup in each page that deletes something. */
export function SettleDebtButton({ id, amount }: { id: string; amount: number }) {
  return (
    <form
      action={settleTripDebtAction}
      onSubmit={(e) => {
        if (!window.confirm(`${formatSom(amount)} тўланди деб белгилансинми?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="bg-success text-white rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap"
      >
        Тўланди
      </button>
    </form>
  );
}
