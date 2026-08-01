import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FleetDashboard } from "@/components/dashboard/FleetDashboard";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

export default async function AdminPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { period: periodParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const vm = await getOwnerDashboardVM(period);

  return (
    <FleetDashboard vm={vm} period={period} basePath="/admin/panel" userName={session.user.name ?? "Админ"} embedded />
  );
}
