import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { getOwnerDashboardVM, getMonthlyTrend } from "@/lib/dashboard";
import { formatMillions, formatSom, uzMonthName } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";

const INCOME_LABELS: Record<string, string> = {
  TRIPS: "Рейс тушуми",
  RENTAL: "Ойлик ижара",
  PLAN: "Кунлик план",
};

export default async function OwnerReportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"))) {
    redirect("/coming-soon");
  }

  const [vm, trend] = await Promise.all([getOwnerDashboardVM("MONTH"), getMonthlyTrend(6)]);

  const incomeByCategory: Record<string, number> = { TRIPS: 0, RENTAL: 0, PLAN: 0 };
  for (const v of vm.vehicles) incomeByCategory[v.incomeSource] += v.income;
  const incomeSplit = Object.entries(incomeByCategory)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => ({
      name: INCOME_LABELS[key] ?? key,
      amount,
      pct: vm.totalIncome > 0 ? (amount / vm.totalIncome) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const margin = vm.totalIncome > 0 ? (vm.netProfit / vm.totalIncome) * 100 : 0;
  const totalTrips = vm.vehicles.reduce((s, v) => s + v.tripCount, 0);
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.income, t.expense)));
  const vehiclesByIncome = [...vm.vehicles].sort((a, b) => b.income - a.income);

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Ойлик ҳисобот · {uzMonthName(new Date())} {new Date().getFullYear()}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {vm.vehicleCount} машина · {vm.driverCount} ҳайдовчи · {totalTrips} рейс
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/owner/report/export/excel"
            className="bg-card border border-border text-body rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]"
          >
            ⬇ Excel
          </Link>
          <Link
            href="/owner/report/export/pdf"
            className="bg-primary text-white rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]"
          >
            ⬇ PDF
          </Link>
          <Link
            href="/owner"
            className="inline-flex items-center self-center ml-2 bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
          >
            ← Панел
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Жами тушум" value={formatMillions(vm.totalIncome)} />
        <KpiCard label="Жами харажат" value={formatMillions(vm.totalExpense)} hintColor="danger" />
        <KpiCard variant="primary" label="Соф фойда" value={formatMillions(vm.netProfit)} />
        <KpiCard label="Рентабеллик" value={`${margin.toFixed(0)}%`} hintColor="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-heading font-bold text-[15px] text-heading mb-3">Даромад манбалари</div>
          {incomeSplit.map((i) => (
            <div key={i.name} className="flex justify-between py-2.5 border-t border-row-divider first:border-t-0 text-sm">
              <span className="font-semibold text-body">{i.name}</span>
              <span className="font-extrabold text-heading">
                {formatSom(i.amount)} <span className="text-muted-2 font-bold">· {i.pct.toFixed(0)}%</span>
              </span>
            </div>
          ))}
          {incomeSplit.length === 0 && <p className="text-[13px] text-muted-2">Бу даврда даромад йўқ</p>}
        </Card>

        <Card className="p-5">
          <div className="font-heading font-bold text-[15px] text-heading mb-3">Харажат тоифалари</div>
          {vm.expenseBreakdown.map((e) => (
            <div key={e.category} className="flex justify-between py-2.5 border-t border-row-divider first:border-t-0 text-sm">
              <span className="font-semibold text-body">{e.category}</span>
              <span className="font-extrabold text-heading">
                {formatSom(e.amount)} <span className="text-muted-2 font-bold">· {e.pct.toFixed(0)}%</span>
              </span>
            </div>
          ))}
          {vm.expenseBreakdown.length === 0 && <p className="text-[13px] text-muted-2">Бу даврда харажат йўқ</p>}
        </Card>
      </div>

      <Card className="p-5">
        <div className="font-heading font-bold text-[15px] text-heading mb-4">Охирги 6 ой динамикаси</div>
        <div className="flex items-end gap-4 h-[160px]">
          {trend.map((t) => (
            <div key={t.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="flex gap-1.5 items-end w-full justify-center h-full">
                <div
                  className="w-[18px] rounded-t-md bg-primary"
                  style={{ height: `${(t.income / maxTrend) * 100}%` }}
                  title={formatSom(t.income)}
                />
                <div
                  className="w-[18px] rounded-t-md bg-[#C9CBE3]"
                  style={{ height: `${(t.expense / maxTrend) * 100}%` }}
                  title={formatSom(t.expense)}
                />
              </div>
              <div className="text-xs text-muted-2 font-bold">{t.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Vehicles — desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="px-6 py-[18px] font-heading font-bold text-base text-heading">
          Машиналар бўйича даромад ва харажат
        </div>
        <div className="grid grid-cols-[1.3fr_1.1fr_0.6fr_0.9fr_0.9fr_0.9fr_0.8fr] px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Машина</div>
          <div>Ҳайдовчи</div>
          <div>Рейслар</div>
          <div>Тушум</div>
          <div>Харажат</div>
          <div>Фойда</div>
          <div>Ҳолат</div>
        </div>
        {vehiclesByIncome.map((v) => (
          <div
            key={v.vehicleId}
            className="grid grid-cols-[1.3fr_1.1fr_0.6fr_0.9fr_0.9fr_0.9fr_0.8fr] px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-primary-tint rounded-md px-2 py-0.5 font-extrabold text-xs text-primary font-heading">
                {v.plate}
              </div>
              <span className="font-semibold text-heading">{v.model}</span>
            </div>
            <div className="text-body font-semibold">{v.driverName}</div>
            <div className="text-muted-2 font-bold">{v.tripCount}</div>
            <div className="font-bold text-heading">{formatSom(v.income)}</div>
            <div className="text-muted-2 font-semibold">{formatSom(v.expense)}</div>
            <div className="font-extrabold text-success">{formatSom(v.profit)}</div>
            <div>
              <StatusPill status={v.status} />
            </div>
          </div>
        ))}
        {vehiclesByIncome.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу даврда маълумот йўқ</p>}
      </Card>

      {/* Vehicles — mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="font-heading font-bold text-base text-heading px-1">Машиналар бўйича даромад ва харажат</div>
        {vehiclesByIncome.map((v) => (
          <Card key={v.vehicleId} className="p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-primary-tint rounded-md px-2 py-0.5 font-extrabold text-xs text-primary font-heading">
                  {v.plate}
                </div>
                <span className="font-semibold text-heading text-sm">{v.model}</span>
              </div>
              <StatusPill status={v.status} />
            </div>
            <div className="text-xs text-muted-2 font-semibold">{v.driverName}</div>
            <div className="flex justify-between text-sm pt-1 border-t border-row-divider">
              <div>
                <div className="text-[11px] text-muted-2 font-bold uppercase">Рейслар</div>
                <div className="font-bold text-heading">{v.tripCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-2 font-bold uppercase">Тушум</div>
                <div className="font-bold text-heading">{formatSom(v.income)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-2 font-bold uppercase">Харажат</div>
                <div className="font-semibold text-muted-2">{formatSom(v.expense)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-2 font-bold uppercase">Фойда</div>
                <div className="font-extrabold text-success">{formatSom(v.profit)}</div>
              </div>
            </div>
          </Card>
        ))}
        {vehiclesByIncome.length === 0 && (
          <Card className="p-4">
            <p className="text-[13px] text-muted-2">Бу даврда маълумот йўқ</p>
          </Card>
        )}
      </div>
    </div>
  );
}
