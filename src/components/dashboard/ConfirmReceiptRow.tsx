"use client";

import { useActionState, useState } from "react";
import { formatSom } from "@/lib/format";
import type { PendingHandoverRow, OwnerPayoutState } from "@/lib/ownerPayout";

const initialState: OwnerPayoutState = { error: "" };

/**
 * One pending handover in a point card, with two ways to accept it:
 * "Қабул қилдим ✓" takes the dispatcher's declared amount as-is; "Бошқа
 * сумма билан" opens a small form for when what was actually counted on
 * receipt doesn't match — mirrors the dispatcher's own override flow
 * (HandoverForm's adjust option) so the two sides of a handover use the
 * same pattern.
 */
export function ConfirmReceiptRow({
  handover,
  confirmAction,
  adjustAction,
}: {
  handover: PendingHandoverRow;
  confirmAction: (formData: FormData) => Promise<void>;
  adjustAction: (prevState: OwnerPayoutState, formData: FormData) => Promise<OwnerPayoutState>;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [state, formAction, pending] = useActionState(adjustAction, initialState);

  return (
    <div className="flex flex-col gap-2 bg-page rounded-xl p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-heading">{formatSom(handover.amount)}</div>
          <div className="text-[11px] text-muted-2 font-semibold">
            {handover.dispatcherName} ·{" "}
            {handover.handoverDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
          </div>
          {handover.note && <div className="text-[11px] text-danger font-semibold">Сабаб: {handover.note}</div>}
        </div>
        {!adjusting && (
          <div className="flex flex-col items-end gap-1">
            <form action={confirmAction}>
              <input type="hidden" name="id" value={handover.id} />
              <button
                type="submit"
                className="bg-success text-white rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap"
              >
                Қабул қилдим ✓
              </button>
            </form>
            <button
              type="button"
              onClick={() => setAdjusting(true)}
              className="text-[11px] text-primary font-bold hover:underline"
            >
              Бошқа сумма билан
            </button>
          </div>
        )}
      </div>
      {adjusting && (
        <form action={formAction} className="flex flex-col gap-1.5">
          <input type="hidden" name="id" value={handover.id} />
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            defaultValue={handover.amount}
            placeholder="Ҳақиқий сумма"
            className="bg-card border-2 border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
          />
          <input
            name="note"
            placeholder="Сабаби (мажбурий)"
            className="bg-card border-2 border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-heading outline-none focus:border-primary"
          />
          {state.error && <p className="text-danger text-[11px] font-bold">{state.error}</p>}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-success text-white rounded-lg px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
            >
              {pending ? "Сақланмоқда…" : "Тасдиқлаш"}
            </button>
            <button
              type="button"
              onClick={() => setAdjusting(false)}
              className="text-xs text-muted-2 font-bold px-2"
            >
              Бекор қилиш
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
