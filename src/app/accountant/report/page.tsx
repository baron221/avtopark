import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FleetDashboard } from "@/components/dashboard/FleetDashboard";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { getCashLedgerSummary } from "@/lib/ownerPayout";
import { hasModuleAccess } from "@/lib/access";
import {
  confirmCashReceiptAction,
  revertCashReceiptAction,
  recordOwnerPayoutAction,
  cancelOwnerPayoutAction,
  setCashOpeningBalanceAction,
} from "./actions";

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
  const period: Period = isPeriod(periodParam) ? periodParam : "DAY";
  const { date, dateStr } = parseDateParam(dateParam);
  const [vm, cashLedger] = await Promise.all([getOwnerDashboardVM(period, date), getCashLedgerSummary(period, date)]);

  return (
    <FleetDashboard
      vm={vm}
      period={period}
      basePath="/accountant/report"
      userName={session.user.name ?? "Бухгалтер"}
      embedded
      date={dateStr}
      exportHref={`/accountant/report/export/excel?period=${period}&date=${dateStr}`}
      cashExportHref={`/accountant/report/export/cash-excel?period=${period}&date=${dateStr}`}
      cashLedger={cashLedger}
      confirmReceiptAction={confirmCashReceiptAction}
      revertReceiptAction={revertCashReceiptAction}
      recordPayoutAction={recordOwnerPayoutAction}
      cancelPayoutAction={cancelOwnerPayoutAction}
      setOpeningBalanceAction={setCashOpeningBalanceAction}
    />
  );
}
