"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ExternalVehicleManager } from "@/components/ExternalVehicleManager";
import { addExternalVehicleAction, deleteExternalVehicleAction } from "@/app/actions";
import { addOtherIncomeAction } from "../income/actions";
import { OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import type { ExternalVehicleRow } from "@/lib/externalVehicle";

const inputClass =
  "w-full bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-xs font-extrabold text-muted-2 mb-1";

/** Deliberately lives on /accountant/report, not its own /new route — a
 * standalone route for this exact same action was observed to sometimes
 * clear the accountant's session on submit (reproduced locally and in
 * production; root cause unconfirmed even after extensive isolation —
 * ruled out redirect(), revalidatePath, useActionState vs plain actions,
 * layout complexity, and the proxy middleware). The identical action
 * invoked from this page never reproduced it, so entry stays here until
 * the underlying framework issue is understood. */
export function IncomeEntryCard({ externalVehicles }: { externalVehicles: ExternalVehicleRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addOtherIncomeAction(formData);
      if (result.error) {
        setError(result.error);
        setSaved(false);
        return;
      }
      setError("");
      router.refresh();
      formRef.current?.reset();
      setResetKey((k) => k + 1);
      setSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-heading font-bold text-[15px] text-heading text-left flex items-center justify-between"
      >
        <span>+ Кирим қўшиш</span>
        <span className="text-muted-2 text-sm">{expanded ? "▲" : "▼"}</span>
      </button>
      <div className="text-[13px] text-muted-2 font-semibold -mt-2">
        Ўз паркимиз машиналаридан ташқари — GPS/литсензия/ойлик хизмат учун тўлайдиган бошқа машиналардан келган пул
      </div>

      {expanded && (
        <>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <div className={labelClass}>Пункт</div>
              <select name="point" required className={inputClass} defaultValue="FARGONA">
                <option value="FARGONA">Фарғона</option>
                <option value="QUVA">Қува</option>
                <option value="BUXGALTERIYA">Бухгалтер</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Тўлов тури</div>
              <select name="category" required className={inputClass} defaultValue="OYLIK_TOLOV">
                {OTHER_INCOME_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {OTHER_INCOME_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelClass}>Машина рақами</div>
              <input
                name="plateNumber"
                list="other-income-external-plates"
                autoComplete="off"
                placeholder="Масалан: 40 O 370 LB"
                className={inputClass}
              />
              <datalist id="other-income-external-plates">
                {externalVehicles.map((v) => (
                  <option key={v.id} value={v.plate} />
                ))}
              </datalist>
            </div>
            <div>
              <div className={labelClass}>Сумма</div>
              <MoneyInput
                name="amount"
                key={`amount-${resetKey}`}
                required
                className={inputClass}
                placeholder="500 000"
              />
            </div>
            <div>
              <div className={labelClass}>Изоҳ</div>
              <input name="note" className={inputClass} placeholder="Ихтиёрий" />
            </div>

            {error && <p className="text-danger text-[13px] font-bold">{error}</p>}
            {saved && <p className="text-success text-[13px] font-bold">✓ Киритилди</p>}

            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-white rounded-xl py-2.5 text-center font-extrabold text-sm disabled:opacity-60"
            >
              {pending ? "Сақланмоқда…" : "Сақлаш"}
            </button>
          </form>

          <ExternalVehicleManager
            vehicles={externalVehicles}
            addAction={addExternalVehicleAction}
            deleteAction={deleteExternalVehicleAction}
          />
        </>
      )}
    </div>
  );
}
