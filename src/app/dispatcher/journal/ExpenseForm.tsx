"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { addStaffExpenseAction, addLunchAction } from "../actions";
import type { Point } from "@prisma/client";

const CATEGORIES = [
  { value: "STOYANKA", label: "Стоянка" },
  { value: "OZIQ_OVQAT", label: "Шахсий озиқ-овқат" },
  { value: "OBED", label: "Обед" },
  { value: "BOSHQA", label: "Бошқа расход" },
];

type LunchPerson = { userId: string; label: string };

export function ExpenseForm({
  point,
  people,
  todayStr,
  monthStartStr,
  defaultDateStr,
}: {
  point?: Point;
  people: LunchPerson[];
  /** ISO yyyy-mm-dd — bounds for the backdate picker below. */
  todayStr: string;
  monthStartStr: string;
  /** ISO yyyy-mm-dd — the day new entries should land on, i.e. whichever
   * day the page itself is currently showing. See IncomeForm's identical
   * prop for the full rationale. */
  defaultDateStr?: string;
}) {
  const router = useRouter();
  const initialDate = defaultDateStr ?? todayStr;
  const [category, setCategory] = useState("STOYANKA");
  const isLunch = category === "OBED";
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showDate, setShowDate] = useState(initialDate !== todayStr);
  const [dateValue, setDateValue] = useState(initialDate);
  const formRef = useRef<HTMLFormElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const action = isLunch ? addLunchAction : addStaffExpenseAction;
    startTransition(async () => {
      await action(formData);
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
      <div className="font-heading font-bold text-[15px] text-danger">− Чиқим киритиш</div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        {point && <input type="hidden" name="point" value={point} />}
        {!isLunch && <input type="hidden" name="category" value={category} />}
        {showDate ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateValue}
              min={monthStartStr}
              max={todayStr}
              onChange={(e) => setDateValue(e.target.value || todayStr)}
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-danger"
            />
            {dateValue !== todayStr && <input type="hidden" name="date" value={dateValue} />}
            <button
              type="button"
              onClick={() => {
                setShowDate(false);
                setDateValue(initialDate);
              }}
              className="text-muted-2 text-xs font-bold hover:text-danger"
            >
              {initialDate === todayStr ? "Бугунга қайтариш" : "Аслига қайтариш"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className="text-primary text-xs font-extrabold hover:underline self-start"
          >
            Санани ўзгартириш
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3.5 py-2 text-[13px] font-extrabold ${
                category === c.value ? "bg-danger text-white" : "bg-page border-2 border-border text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {isLunch && (
          <select
            name="forUserId"
            defaultValue=""
            className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-danger"
          >
            <option value="">Ўзим (сиз)</option>
            {people.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        <MoneyInput
          name="amount"
          required
          placeholder="Сумма"
          key={resetKey}
          className="bg-page border-2 border-danger rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
        />
        {!isLunch && (
          <input
            name="note"
            placeholder="Изоҳ"
            className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-danger"
          />
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-danger text-white rounded-xl py-3 font-extrabold text-sm disabled:opacity-60"
        >
          {pending ? "Сақланмоқда…" : "Сақлаш ✓"}
        </button>
        {saved && (
          <div className="flex items-center justify-center gap-1.5 text-danger font-extrabold text-[13px]">
            <span>✓</span> Киритилди
          </div>
        )}
      </form>
    </div>
  );
}
