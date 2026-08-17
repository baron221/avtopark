import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { formatSom, formatDayMonth, formatTime } from "@/lib/format";
import type { OutsideExpenseDetailRow } from "@/lib/ownerPayout";

/** Vehicle repair/fuel bills, advances, salaries, station payments — not
 * Farg'ona/Quva point expense, so it doesn't belong on either point card.
 * Collapsed by default, same as the per-point vehicle listings below it. */
export function OutsideExpensesCard({ periodWord, rows }: { periodWord: string; rows: OutsideExpenseDetailRow[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <CollapsibleCard
      title={
        <div>
          <div className="font-heading font-bold text-base text-heading">Бошқа чиқимлар · {periodWord}</div>
          <div className="text-xs text-danger font-bold mt-0.5">
            −{formatSom(total)} · {rows.length} та ёзув
          </div>
        </div>
      }
    >
      <div className="px-5 pb-4 flex flex-col gap-1">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-2 text-xs py-1.5 border-t border-row-divider first:border-t-0"
          >
            <div className="min-w-0">
              <div className="text-muted-2 font-semibold">
                {formatDayMonth(r.time)} · {formatTime(r.time)}
              </div>
              <div className="text-body font-semibold">
                {r.category} · {r.subtitle}
                {r.note && <span className="text-muted-2"> · {r.note}</span>}
              </div>
            </div>
            <span className="font-bold text-danger whitespace-nowrap">−{formatSom(r.amount)}</span>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}
