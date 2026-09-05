import { Card } from "@/components/ui/Card";
import { formatSom } from "@/lib/format";

export type ContributionRow = {
  dispatcherId: string;
  dispatcherName: string;
  amount: number;
  submitted: boolean;
};

/** Shown only when more than one dispatcher had activity at this point/day
 * (shift rotation, the exact case the client asked for) — a plain read-only
 * server component, no interactivity needed. Each person's own figure comes
 * from the same getPointDayContributions map their own handover card would
 * use, so this never disagrees with what they'd actually submit. */
export function PointContributions({
  contributions,
  currentUserId,
}: {
  contributions: ContributionRow[];
  currentUserId: string;
}) {
  return (
    <Card className="p-4 flex flex-col gap-2.5">
      <div className="font-heading font-bold text-sm text-heading">Бугун ким қанча йиғди</div>
      <div className="flex flex-col gap-1.5">
        {contributions.map((c) => (
          <div key={c.dispatcherId} className="flex items-center justify-between gap-2 text-[13px]">
            <span className={`font-bold ${c.dispatcherId === currentUserId ? "text-primary" : "text-body"}`}>
              {c.dispatcherName}
              {c.dispatcherId === currentUserId ? " (сиз)" : ""}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-heading">{formatSom(c.amount)}</span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  c.submitted ? "bg-success/10 text-success" : "bg-primary-tint text-primary"
                }`}
              >
                {c.submitted ? "✓ Топширилди" : "Кутилмоқда"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
