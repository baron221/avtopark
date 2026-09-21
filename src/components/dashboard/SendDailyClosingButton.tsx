"use client";

import { useState, useTransition } from "react";

/** Sends an external, hard-to-undo message (to the real owner's Telegram),
 * so this asks before firing — the same confirm-before-submit pattern as
 * ConfirmDeleteButton, just without a <form> since the action takes no
 * per-row id. */
export function SendDailyClosingButton({
  action,
  label = "Кунни якунлаш",
  confirmText = "Бугунги ҳисоботни Telegram орқали эгасига жўнатишни тасдиқлайсизми?",
}: {
  action: () => Promise<{ error: string }>;
  label?: string;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          startTransition(async () => {
            const res = await action();
            if (res.error) {
              setStatus("error");
              setErrorMsg(res.error);
            } else {
              setStatus("sent");
            }
          });
        }}
        className="w-60 text-center bg-card border border-border text-body text-xs font-extrabold px-3 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Жўнатилмоқда…" : label}
      </button>
      {status === "sent" && <span className="text-[11px] text-success font-bold">✓ Жўнатилди</span>}
      {status === "error" && <span className="text-[11px] text-danger font-bold">{errorMsg}</span>}
    </div>
  );
}
