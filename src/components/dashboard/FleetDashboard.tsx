import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { StatusPill } from "@/components/ui/StatusPill";
import { WeeklyBarChart } from "@/components/charts/WeeklyBarChart";
import type { OwnerDashboardVM, Period } from "@/lib/dashboard";
import { formatMillions, formatSom } from "@/lib/format";
import { logoutAction } from "@/app/actions";

const CATEGORY_COLORS = ["#4F46E5", "#FFB84D", "#1B9E6B", "#D9534F", "#C9CBE3", "#8A8CA0", "#6B6D82"];

export function FleetDashboard({
  vm,
  period,
  basePath,
  userName,
  extraLinks = [],
}: {
  vm: OwnerDashboardVM;
  period: Period;
  basePath: string;
  userName: string;
  extraLinks?: { href: string; label: string }[];
}) {
  const initial = userName?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="max-w-[1180px] mx-auto w-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-7 py-[18px] bg-card border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div>
            <div className="font-heading font-bold text-base text-heading">Farg&apos;ona–Quva Avtopark</div>
            <div className="text-xs text-muted-2">
              {vm.vehicleCount} ta mashina · {vm.driverCount} haydovchi
            </div>
          </div>
        </div>

        <PeriodToggle active={period} basePath={basePath} />

        <div className="flex items-center gap-2.5">
          {extraLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-extrabold text-primary bg-primary-tint px-3 py-1.5 rounded-lg"
            >
              {link.label}
            </Link>
          ))}
          <div className="text-[13px] font-semibold text-heading">{userName}</div>
          <div className="w-[34px] h-[34px] rounded-full bg-accent text-white flex items-center justify-center font-extrabold text-sm">
            {initial}
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs font-bold text-muted-2 hover:text-danger">
              Chiqish
            </button>
          </form>
        </div>
      </div>

      <div className="p-4 sm:p-7 flex flex-col gap-5">
        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            variant="primary"
            label={`Sof foyda · ${vm.periodLabel}`}
            value={formatMillions(vm.netProfit, true)}
            hint={
              vm.profitChangePct !== null
                ? `${vm.profitChangePct >= 0 ? "↑" : "↓"} ${Math.abs(vm.profitChangePct).toFixed(0)}% o'tgan davrga nisbatan`
                : undefined
            }
          />
          <KpiCard
            label="Jami tushum"
            value={formatMillions(vm.totalIncome)}
            hint="reys + plan + ijara"
            hintColor="success"
          />
          <KpiCard
            label="Jami xarajat"
            value={formatMillions(vm.totalExpense)}
            hint="davr bo'yicha"
            hintColor="danger"
          />
          <KpiCard
            label="Bugun plan topshirdi"
            value={`${vm.planToday.paid} / ${vm.planToday.total}`}
            hint={`${vm.planToday.total - vm.planToday.paid} ta mashina kutilmoqda`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Chart card */}
          <Card className="p-6">
            <div className="flex justify-between items-center">
              <div className="font-heading font-bold text-base text-heading">Haftalik foyda dinamikasi</div>
              <div className="flex gap-3.5 text-xs font-bold">
                <span className="text-primary">● Tushum</span>
                <span className="text-[#C9CBE3]">● Xarajat</span>
              </div>
            </div>
            <WeeklyBarChart data={vm.chart} />
          </Card>

          {/* Expense breakdown */}
          <Card className="p-6 flex flex-col gap-3.5">
            <div className="font-heading font-bold text-base text-heading">
              Xarajatlar tarkibi · {vm.periodLabel}
            </div>
            <div className="flex h-3.5 rounded-lg overflow-hidden">
              {vm.expenseBreakdown.map((e, i) => (
                <div
                  key={e.category}
                  style={{ width: `${e.pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
              ))}
            </div>
            {vm.expenseBreakdown.map((e, i) => (
              <div key={e.category} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-[3px]"
                    style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-[13px] font-semibold text-body">{e.category}</span>
                </div>
                <span className="text-[13px] font-extrabold text-heading">{formatSom(e.amount)}</span>
              </div>
            ))}
            {vm.expenseBreakdown.length === 0 && (
              <p className="text-[13px] text-muted-2">Bu davrda xarajat yozilmagan</p>
            )}
          </Card>
        </div>

        {/* Vehicles — desktop table */}
        <Card className="overflow-hidden hidden lg:block">
          <div className="flex justify-between items-center px-6 py-[18px]">
            <div className="font-heading font-bold text-base text-heading">Mashinalar bo&apos;yicha foyda</div>
            <div className="text-[13px] font-bold text-primary">Barchasi ({vm.vehicles.length}) →</div>
          </div>
          <div className="grid grid-cols-[1.3fr_1.1fr_0.6fr_0.9fr_0.9fr_0.9fr_0.8fr] px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
            <div>Mashina</div>
            <div>Haydovchi</div>
            <div>Reyslar</div>
            <div>Tushum</div>
            <div>Xarajat</div>
            <div>Foyda</div>
            <div>Holat</div>
          </div>
          {vm.vehicles.map((v) => (
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
        </Card>

        {/* Vehicles — mobile cards */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="font-heading font-bold text-base text-heading px-1">Mashinalar bo&apos;yicha foyda</div>
          {vm.vehicles.map((v) => (
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
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Reyslar</div>
                  <div className="font-bold text-heading">{v.tripCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Tushum</div>
                  <div className="font-bold text-heading">{formatSom(v.income)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Xarajat</div>
                  <div className="font-semibold text-muted-2">{formatSom(v.expense)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Foyda</div>
                  <div className="font-extrabold text-success">{formatSom(v.profit)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
