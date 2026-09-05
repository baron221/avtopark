import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FleetDashboard } from "@/components/dashboard/FleetDashboard";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { getMechanicCostSummary } from "@/lib/ownerPayout";
import { getPointContributionsForDay } from "@/lib/cashHandover";

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined): { date: Date; dateStr: string } {
  if (value && DATE_RE.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return { date: parsed, dateStr: value };
  }
  const today = new Date();
  return { date: today, dateStr: today.toISOString().slice(0, 10) };
}

export default async function AdminPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { period: periodParam, date: dateParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const { date, dateStr } = parseDateParam(dateParam);
  const [vm, mechanicCostSummary, pointContributions] = await Promise.all([
    getOwnerDashboardVM(period, date),
    getMechanicCostSummary(),
    // Only meaningful for a single day — see FleetDashboard's own comment.
    period === "DAY" ? getPointContributionsForDay(date) : Promise.resolve(undefined),
  ]);

  return (
    <FleetDashboard
      vm={vm}
      period={period}
      basePath="/admin/panel"
      userName={session.user.name ?? "Админ"}
      embedded
      date={dateStr}
      mechanicCostSummary={mechanicCostSummary}
      pointContributions={pointContributions}
    />
  );
}
