import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { DatePicker } from "@/components/ui/DatePicker";
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
  embedded = false,
  date,
  exportHref,
}: {
  vm: OwnerDashboardVM;
  period: Period;
  basePath: string;
  userName: string;
  extraLinks?: { href: string; label: string }[];
  /** True when a role layout already renders its own top bar/logout — skips FleetDashboard's own. */
  embedded?: boolean;
  /** ISO yyyy-mm-dd. When set, shows a date picker and a totals footer under the vehicles table. */
  date?: string;
  /** When set, shows an Excel download link pointed at this route (query-string-compatible with period/date). */
  exportHref?: string;
}) {
  const initial = userName?.[0]?.toUpperCase() ?? "?";
  const activeVehicleCount = vm.vehicles.filter((v) => v.tripCount > 0 || v.income > 0).length;

  return (
    <div className="max-w-[1180px] mx-auto w-full flex flex-col">
      {!embedded && (
        <div className="flex items-center justify-between px-7 py-[18px] bg-card border-b border-border flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
              FQ
            </div>
            <div>
              <div className="font-heading font-bold text-base text-heading">Фарғона–Қува Автопарк</div>
              <div className="text-xs text-muted-2">
                {vm.vehicleCount} та машина · {vm.driverCount} ҳайдовчи
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
                Чиқиш
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-7 flex flex-col gap-5">
        {embedded && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-[13px] text-muted-2 font-semibold">
              {vm.vehicleCount} та машина · {vm.driverCount} ҳайдовчи
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {extraLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-extrabold text-primary bg-primary-tint px-3 py-1.5 rounded-lg"
                >
                  {link.label}
                </Link>
              ))}
              {date && <DatePicker basePath={basePath} period={period} value={date} />}
              <PeriodToggle active={period} basePath={basePath} date={date} />
              {exportHref && (
                <a
                  href={exportHref}
                  className="bg-card border border-border text-body text-xs font-extrabold px-3 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-colors"
                >
                  ⬇ Excel
                </a>
              )}
            </div>
          </div>
        )}
        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            variant="primary"
            label={`Соф фойда · ${vm.periodLabel}`}
            value={formatMillions(vm.netProfit, true)}
            hint={
              vm.profitChangePct !== null
                ? `${vm.profitChangePct >= 0 ? "↑" : "↓"} ${Math.abs(vm.profitChangePct).toFixed(0)}% ўтган даврга нисбатан`
                : undefined
            }
          />
          <KpiCard
            label="Жами тушум"
            value={formatMillions(vm.totalIncome)}
            hint="рейс + план + ижара"
            hintColor="success"
            href="/owner/report#income-sources"
          />
          <KpiCard
            label="Жами харажат"
            value={formatMillions(vm.totalExpense)}
            hint="давр бўйича"
            hintColor="danger"
            href="/owner/report#expense-categories"
          />
          <KpiCard
            label="Бугун план топширди"
            value={`${vm.planToday.paid} / ${vm.planToday.total}`}
            hint={`${vm.planToday.total - vm.planToday.paid} та машина кутилмоқда`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Chart card */}
          <Card className="p-6">
            <div className="flex justify-between items-center">
              <div className="font-heading font-bold text-base text-heading">Ҳафталик фойда динамикаси</div>
              <div className="flex gap-3.5 text-xs font-bold">
                <span className="text-primary">● Тушум</span>
                <span className="text-[#C9CBE3]">● Харажат</span>
              </div>
            </div>
            <WeeklyBarChart data={vm.chart} />
          </Card>

          {/* Expense breakdown */}
          <Card className="p-6 flex flex-col gap-3.5">
            <div className="font-heading font-bold text-base text-heading">
              Харажатлар таркиби · {vm.periodLabel}
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
              <p className="text-[13px] text-muted-2">Бу даврда харажат ёзилмаган</p>
            )}
          </Card>
        </div>

        {/* Vehicles — desktop table */}
        <Card className="overflow-hidden hidden lg:block">
          <div className="flex justify-between items-center px-6 py-[18px]">
            <div className="font-heading font-bold text-base text-heading">Машиналар бўйича фойда</div>
            <div className="text-[13px] font-bold text-primary">Барчаси ({vm.vehicles.length}) →</div>
          </div>
          <div className="grid grid-cols-[1.3fr_1.1fr_0.6fr_0.6fr_0.9fr_0.9fr_0.9fr_0.8fr] px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
            <div>Машина</div>
            <div>Ҳайдовчи</div>
            <div>Рейслар</div>
            <div>Заказ</div>
            <div>Тушум</div>
            <div>Харажат</div>
            <div>Фойда</div>
            <div>Ҳолат</div>
          </div>
          {vm.vehicles.map((v) => (
            <div
              key={v.vehicleId}
              className="grid grid-cols-[1.3fr_1.1fr_0.6fr_0.6fr_0.9fr_0.9fr_0.9fr_0.8fr] px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-primary-tint rounded-md px-2 py-0.5 font-extrabold text-xs text-primary font-heading">
                  {v.plate}
                </div>
                <span className="font-semibold text-heading">{v.model}</span>
              </div>
              <div className="text-body font-semibold">{v.driverName}</div>
              <div className="text-muted-2 font-bold">{v.tripCount}</div>
              <div className="text-muted-2 font-bold">{v.orderCount}</div>
              <div className="font-bold text-heading">{formatSom(v.income)}</div>
              <div className="text-muted-2 font-semibold">{formatSom(v.expense)}</div>
              <div className="font-extrabold text-success">{formatSom(v.profit)}</div>
              <div>
                <StatusPill status={v.status} />
              </div>
            </div>
          ))}
          {date && (
            <div className="grid grid-cols-[1.3fr_1.1fr_0.6fr_0.6fr_0.9fr_0.9fr_0.9fr_0.8fr] px-6 py-3.5 border-t-2 border-primary bg-primary-tint items-center text-sm">
              <div className="font-extrabold text-heading col-span-2">
                Жами: {activeVehicleCount} / {vm.vehicles.length} машина қатнади
              </div>
              <div></div>
              <div></div>
              <div className="font-extrabold text-heading">{formatSom(vm.totalIncome)}</div>
              <div className="font-extrabold text-heading">{formatSom(vm.totalExpense)}</div>
              <div className="font-extrabold text-success">{formatSom(vm.netProfit)}</div>
              <div></div>
            </div>
          )}
        </Card>

        {/* Vehicles — mobile cards */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="font-heading font-bold text-base text-heading px-1">Машиналар бўйича фойда</div>
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
              <div className="flex justify-between text-sm pt-1 border-t border-row-divider flex-wrap gap-y-2">
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Рейслар</div>
                  <div className="font-bold text-heading">{v.tripCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Заказ</div>
                  <div className="font-bold text-heading">{v.orderCount}</div>
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
          {date && (
            <Card className="p-4 flex flex-col gap-2 border-2 border-primary bg-primary-tint">
              <div className="font-extrabold text-heading text-sm">
                Жами: {activeVehicleCount} / {vm.vehicles.length} машина қатнади
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Тушум</div>
                  <div className="font-extrabold text-heading">{formatSom(vm.totalIncome)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Харажат</div>
                  <div className="font-extrabold text-heading">{formatSom(vm.totalExpense)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-2 font-bold uppercase">Фойда</div>
                  <div className="font-extrabold text-success">{formatSom(vm.netProfit)}</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
