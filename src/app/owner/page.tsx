import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FleetDashboard } from "@/components/dashboard/FleetDashboard";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { getGrantedNavLinks, getGuestNavLinks, hasModuleAccess } from "@/lib/access";

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isOwner = session.user.role === "OWNER";
  if (!isOwner && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"))) redirect("/coming-soon");

  const { period: periodParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const [vm, grantedLinks] = await Promise.all([
    getOwnerDashboardVM(period),
    isOwner ? getGrantedNavLinks(session.user.role, ["FLEET_DASHBOARD"]) : getGuestNavLinks(session.user.role),
  ]);

  return (
    <FleetDashboard
      vm={vm}
      period={period}
      basePath="/owner"
      userName={session.user.name ?? "Egasi"}
      extraLinks={
        isOwner
          ? [
              { href: "/owner/report", label: "Hisobot" },
              { href: "/owner/drivers", label: "Haydovchilar" },
              ...grantedLinks.map((l) => ({ href: l.href, label: l.label })),
            ]
          : grantedLinks.map((l) => ({ href: l.href, label: l.label }))
      }
    />
  );
}
