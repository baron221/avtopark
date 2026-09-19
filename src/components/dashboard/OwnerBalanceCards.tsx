import { KpiCard } from "@/components/ui/KpiCard";
import { formatMillions } from "@/lib/format";
import type { MechanicCostSummary } from "@/lib/ownerPayout";

// Full literal class names — Tailwind can't see a dynamically-built
// `sm:grid-cols-${n}`, and only the debt/other cards are conditional.
const COLS: Record<number, string> = { 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-6" };

/** The owner's-balance KPI row, shared by every page that shows it (owner,
 * admin, mechanic's fuel page, accountant's owner-balance page) so the
 * conditional cards can't drift between them. */
export function OwnerBalanceCards({ summary }: { summary: MechanicCostSummary }) {
  const count = 4 + (summary.debtSettled > 0 ? 1 : 0) + (summary.otherSpent > 0 ? 1 : 0);
  return (
    <div className={`grid grid-cols-1 gap-4 ${COLS[count]}`}>
      {summary.debtSettled > 0 && (
        <KpiCard label="Насиядан келган (эгага)" value={formatMillions(summary.debtSettled)} />
      )}
      <KpiCard label="Ёқилғи учун сарфланган" value={formatMillions(summary.fuelSpent)} />
      <KpiCard label="Мой учун сарфланган" value={formatMillions(summary.oilSpent)} />
      {summary.otherSpent > 0 && <KpiCard label="Бошқа сарфлар" value={formatMillions(summary.otherSpent)} />}
      <KpiCard label="Жами сарфланган" value={formatMillions(summary.totalSpent)} />
      <KpiCard variant="primary" label="Жак ҳаққи" value={formatMillions(summary.balance)} />
    </div>
  );
}
