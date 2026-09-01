"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addStaffExpenseAction } from "../expenses/actions";

const inputClass =
  "w-full bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-xs font-extrabold text-muted-2 mb-1";

/** Deliberately lives on /accountant/report, not its own /new route — see
 * addStaffExpenseAction's own comment (accountant/expenses/actions.ts)
 * for why. */
export function ExpenseEntryCard() {
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
      const result = await addStaffExpenseAction(formData);
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
        <span>+ Бошқа расход</span>
        <span className="text-muted-2 text-sm">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <div className={labelClass}>Пункт</div>
            <select name="point" required className={inputClass} defaultValue="FARGONA">
              <option value="FARGONA">Фарғона</option>
              <option value="QUVA">Қува</option>
              <option value="YOLDA">Йўлда</option>
              <option value="ISHXONA">Ишхона</option>
            </select>
          </div>
          <div>
            <div className={labelClass}>Тоифа</div>
            <select name="category" required className={inputClass} defaultValue="BOSHQA">
              <option value="STOYANKA">Стоянка</option>
              <option value="OZIQ_OVQAT">Озиқ-овқат</option>
              <option value="OBED">Обед</option>
              <option value="BOSHQA">Бошқа</option>
            </select>
          </div>
          <div>
            <div className={labelClass}>Сумма</div>
            <MoneyInput name="amount" key={`amount-${resetKey}`} required className={inputClass} placeholder="50 000" />
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
      )}
    </div>
  );
}
