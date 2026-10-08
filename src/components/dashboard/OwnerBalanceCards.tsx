import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatMillions, formatSom } from "@/lib/format";
import type { MechanicCostSummary } from "@/lib/ownerPayout";

// Full literal class names — Tailwind can't see a dynamically-built
// `sm:grid-cols-${n}`, and only the "other spending" card is conditional.
const COLS: Record<number, string> = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

/** The owner's-balance KPI row, shared by every page that shows it (owner,
 * admin, mechanic's fuel page, accountant's owner-balance page) so the
 * conditional cards can't drift between them. "Банкдаги пул" itself is its
 * own larger card up top (not one of this row's small KpiCards) — per
 * explicit request, both more prominent and detailed (the equation behind
 * the number, not just the total) than a KpiCard's tight label+value+hint
 * layout has room for. */
export function OwnerBalanceCards({ summary }: { summary: MechanicCostSummary }) {
  const count = 3 + (summary.otherSpent > 0 ? 1 : 0);
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6 flex flex-col gap-3">
        <div className="text-[11px] text-muted-2 font-bold uppercase">Банкдаги пул</div>
        <div className="font-heading font-extrabold text-3xl text-heading">{formatSom(summary.balance)}</div>
        <div className="text-[13px] font-bold text-body flex items-center gap-1.5 flex-wrap">
          <span className="text-success">{formatSom(summary.paidToOwner)}</span>
          <span className="text-[11px] font-semibold text-muted-2">эгасига топширилган</span>
          {summary.corrections > 0 && (
            <>
              <span className="text-muted-2">+</span>
              <span className="text-success">{formatSom(summary.corrections)}</span>
              <span className="text-[11px] font-semibold text-muted-2">тузатиш</span>
            </>
          )}
          <span className="text-muted-2">−</span>
          <span className="text-danger">{formatSom(summary.totalSpent)}</span>
          <span className="text-[11px] font-semibold text-muted-2">сарфланган</span>
          <span className="text-muted-2">=</span>
          <span className="font-extrabold text-heading">{formatSom(summary.balance)}</span>
        </div>
      </Card>

      <div className={`grid grid-cols-1 gap-4 ${COLS[count]}`}>
        <KpiCard label="Ёқилғи учун сарфланган" value={formatMillions(summary.fuelSpent)} />
        <KpiCard label="Мой учун сарфланган" value={formatMillions(summary.oilSpent)} />
        {summary.otherSpent > 0 && <KpiCard label="Бошқа сарфлар" value={formatMillions(summary.otherSpent)} />}
        <KpiCard label="Жами сарфланган" value={formatMillions(summary.totalSpent)} />
      </div>
    </div>
  );
}
