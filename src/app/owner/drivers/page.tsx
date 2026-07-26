import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { formatSom } from "@/lib/format";
import { getDriverReportRows } from "@/lib/driverReport";
import { hasModuleAccess } from "@/lib/access";

export default async function OwnerDriversPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"))) {
    redirect("/coming-soon");
  }

  const rows = await getDriverReportRows("MONTH");

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="font-heading font-bold text-xl text-heading">Haydovchilar · {rows.length}</div>
        <Link href="/owner" className="text-[13px] font-bold text-muted-2 hover:text-primary">
          ← Panel
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.4fr_1.1fr_0.7fr_1.3fr_0.8fr_1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Haydovchi</div>
          <div>Mashina</div>
          <div>Reyslar</div>
          <div>Plan bajarilishi</div>
          <div>Maosh</div>
          <div>Sof hissa</div>
        </div>
        {rows.map((d) => (
          <div
            key={d.driverId}
            className="grid grid-cols-2 lg:grid-cols-[1.4fr_1.1fr_0.7fr_1.3fr_0.8fr_1fr] gap-y-1.5 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="font-extrabold text-heading col-span-2 lg:col-span-1">{d.name}</div>
            <div className="font-bold text-primary font-heading">{d.plate}</div>
            <div className="text-body font-bold">{d.tripCount}</div>
            <div className="flex items-center gap-2.5">
              {d.planPct === null ? (
                <span className="text-xs text-muted-2 font-bold">reys asosida</span>
              ) : (
                <>
                  <div className="flex-1 h-2 bg-primary-tint rounded-md overflow-hidden max-w-[120px]">
                    <div
                      className="h-full bg-primary rounded-md"
                      style={{ width: `${Math.min(100, d.planPct)}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-muted w-10">{Math.round(d.planPct)}%</span>
                </>
              )}
            </div>
            <div className="text-body font-bold">{formatSom(d.salary)}</div>
            <div className={`font-extrabold ${d.netContribution >= 0 ? "text-success" : "text-danger"}`}>
              {d.netContribution >= 0 ? "+" : ""}
              {formatSom(d.netContribution)}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Haydovchi topilmadi</p>}
      </Card>
    </div>
  );
}
