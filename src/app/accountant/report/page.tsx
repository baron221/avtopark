import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { FleetDashboard } from "@/components/dashboard/FleetDashboard";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { confirmCashReceiptAction, confirmPlanReceiptAction } from "./actions";

const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

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

export default async function AccountantReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"))) {
    redirect("/coming-soon");
  }

  const { period: periodParam, date: dateParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const { date, dateStr } = parseDateParam(dateParam);
  const [vm, pendingHandovers, pendingPlanHandovers] = await Promise.all([
    getOwnerDashboardVM(period, date),
    prisma.cashHandover.findMany({
      where: { accountantConfirmedAt: null },
      orderBy: { handoverDate: "asc" },
      include: { dispatcherConfirmedByUser: true },
    }),
    prisma.planHandover.findMany({
      where: { confirmedAt: null },
      orderBy: { handoverDate: "asc" },
      include: { reportedByUser: true, vehicle: true },
    }),
  ]);

  return (
    <>
      {pendingHandovers.length > 0 && (
        <div className="max-w-[1180px] mx-auto w-full px-4 sm:px-7 pt-4 sm:pt-7">
          <Card className="p-5 flex flex-col gap-3">
            <div className="font-heading font-bold text-[15px] text-heading">
              Диспетчерлардан қабул қилинадиган пуллар
            </div>
            {pendingHandovers.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between flex-wrap gap-3 py-2.5 border-t border-row-divider first:border-t-0"
              >
                <div>
                  <div className="text-sm font-extrabold text-heading">
                    {POINT_LABELS[h.point] ?? h.point} ·{" "}
                    {h.handoverDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
                  </div>
                  <div className="text-xs text-muted-2 font-semibold">
                    {h.dispatcherConfirmedByUser.fullName} топширди · {formatSom(Number(h.amount))}
                  </div>
                </div>
                <form action={confirmCashReceiptAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button
                    type="submit"
                    className="bg-success text-white rounded-[10px] px-4 py-2 font-extrabold text-[13px]"
                  >
                    Қабул қилдим ✓
                  </button>
                </form>
              </div>
            ))}
          </Card>
        </div>
      )}
      {pendingPlanHandovers.length > 0 && (
        <div className="max-w-[1180px] mx-auto w-full px-4 sm:px-7 pt-4 sm:pt-7">
          <Card className="p-5 flex flex-col gap-3">
            <div className="font-heading font-bold text-[15px] text-heading">Кунлик план тўловлари</div>
            {pendingPlanHandovers.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between flex-wrap gap-3 py-2.5 border-t border-row-divider first:border-t-0"
              >
                <div>
                  <div className="text-sm font-extrabold text-heading">
                    {h.vehicle.plate} ·{" "}
                    {h.handoverDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
                  </div>
                  <div className="text-xs text-muted-2 font-semibold">
                    {h.reportedByUser.fullName} тўлади · {formatSom(Number(h.amount))}
                  </div>
                </div>
                <form action={confirmPlanReceiptAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button
                    type="submit"
                    className="bg-success text-white rounded-[10px] px-4 py-2 font-extrabold text-[13px]"
                  >
                    Қабул қилдим ✓
                  </button>
                </form>
              </div>
            ))}
          </Card>
        </div>
      )}
      <FleetDashboard
        vm={vm}
        period={period}
        basePath="/accountant/report"
        userName={session.user.name ?? "Бухгалтер"}
        embedded
        date={dateStr}
        exportHref={`/accountant/report/export/excel?period=${period}&date=${dateStr}`}
      />
    </>
  );
}
