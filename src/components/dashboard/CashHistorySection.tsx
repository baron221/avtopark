"use client";

import { useState } from "react";
import { formatSom } from "@/lib/format";
import type { ConfirmedHandoverRow, OwnerPayoutRow } from "@/lib/ownerPayout";

const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

export function CashHistorySection({
  confirmedHistory,
  payoutHistory,
  revertReceiptAction,
  cancelPayoutAction,
}: {
  confirmedHistory: ConfirmedHandoverRow[];
  payoutHistory: OwnerPayoutRow[];
  revertReceiptAction?: (formData: FormData) => Promise<void>;
  cancelPayoutAction?: (formData: FormData) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (confirmedHistory.length === 0 && payoutHistory.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-primary text-xs font-extrabold hover:underline"
      >
        {expanded ? "Тарихни яшириш ▲" : "Тарихни кўрсатиш ▼"}
      </button>
      {expanded && (
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] text-muted-2 font-bold uppercase">Топширилган (тасдиқланган)</div>
            {confirmedHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-2 font-semibold">
                  {h.handoverDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} ·{" "}
                  {POINT_LABELS[h.point] ?? h.point} · {h.dispatcherName} → {h.accountantName}
                  {h.note ? ` · Сабаб: ${h.note}` : ""}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-heading whitespace-nowrap">{formatSom(h.amount)}</span>
                  {revertReceiptAction && (
                    <form
                      action={revertReceiptAction}
                      onSubmit={(e) => {
                        if (!window.confirm("Қабул қилинганини бекор қиламизми?")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={h.id} />
                      <button type="submit" className="text-danger text-[11px] font-bold hover:underline whitespace-nowrap">
                        Бекор қилиш
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {confirmedHistory.length === 0 && <p className="text-xs text-muted-2">Ҳали йўқ</p>}
          </div>
          <div className="flex flex-col gap-1.5 pt-2 border-t border-row-divider">
            <div className="text-[11px] text-muted-2 font-bold uppercase">Эгасига тўланган</div>
            {payoutHistory.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-2 font-semibold">
                  {p.payoutDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} ·{" "}
                  {p.enteredByName}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-primary whitespace-nowrap">−{formatSom(p.amount)}</span>
                  {cancelPayoutAction && (
                    <form
                      action={cancelPayoutAction}
                      onSubmit={(e) => {
                        if (!window.confirm("Эгасига тўланганини бекор қиламизми?")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-danger text-[11px] font-bold hover:underline whitespace-nowrap">
                        Бекор қилиш
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {payoutHistory.length === 0 && <p className="text-xs text-muted-2">Ҳали йўқ</p>}
          </div>
        </div>
      )}
    </div>
  );
}
