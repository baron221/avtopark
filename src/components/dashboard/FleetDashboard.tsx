import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { DatePicker } from "@/components/ui/DatePicker";
import { StatusPill } from "@/components/ui/StatusPill";
import { WeeklyBarChart } from "@/components/charts/WeeklyBarChart";
import { OwnerPayoutForm } from "@/components/dashboard/OwnerPayoutForm";
import { CashOpeningBalanceForm } from "@/components/dashboard/CashOpeningBalanceForm";
import { CashHistorySection } from "@/components/dashboard/CashHistorySection";
import type { OwnerDashboardVM, Period } from "@/lib/dashboard";
import type { CashLedgerSummary, OwnerPayoutState, MonthlyPayoutPoint } from "@/lib/ownerPayout";
import { formatMillions, formatSom, formatTime } from "@/lib/format";
import { logoutAction } from "@/app/actions";

const CATEGORY_COLORS = ["#4F46E5", "#FFB84D", "#1B9E6B", "#D9534F", "#C9CBE3", "#8A8CA0", "#6B6D82"];
const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

export function FleetDashboard({
  vm,
  period,
  basePath,
  userName,
  extraLinks = [],
  embedded = false,
  date,
  exportHref,
  cashLedger,
  confirmReceiptAction,
  revertReceiptAction,
  recordPayoutAction,
  setOpeningBalanceAction,
  ownerPayoutSummary,
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
  /** Accountant-only cash data (pending confirmations per point + a combined running balance/history). Passed only by /accountant/report — Owner/Admin omit it entirely, so this whole section renders nothing for them. */
  cashLedger?: CashLedgerSummary;
  confirmReceiptAction?: (formData: FormData) => Promise<void>;
  revertReceiptAction?: (formData: FormData) => Promise<void>;
  recordPayoutAction?: (prevState: OwnerPayoutState, formData: FormData) => Promise<OwnerPayoutState>;
  setOpeningBalanceAction?: (prevState: OwnerPayoutState, formData: FormData) => Promise<OwnerPayoutState>;
  /** Owner-only, read-only view of what's actually been paid out to them — passed only by /owner. */
  ownerPayoutSummary?: { thisMonth: number; lastMonth: number; trend: MonthlyPayoutPoint[] };
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
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

        {/* Point breakdown */}
        {vm.pointBreakdown.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {vm.pointBreakdown.map((p) => {
              const totalIncome = p.tripIncome + p.orderIncome;
              return (
                <Card key={p.point} className="p-6 flex flex-col gap-3.5">
                  <div className="font-heading font-bold text-base text-heading">
                    {POINT_LABELS[p.point]} пункти · {vm.periodLabel}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-page rounded-xl p-3.5">
                      <div className="text-[11px] text-muted-2 font-bold uppercase">Рейс тушуми</div>
                      <div className="font-heading font-extrabold text-lg text-success">
                        {formatSom(p.tripIncome)}
                      </div>
                      <div className="text-xs text-muted-2 font-semibold">{p.tripCount} та рейс</div>
                    </div>
                    <div className="bg-page rounded-xl p-3.5">
                      <div className="text-[11px] text-muted-2 font-bold uppercase">Заказ тушуми</div>
                      <div className="font-heading font-extrabold text-lg text-success">
                        {formatSom(p.orderIncome)}
                      </div>
                      <div className="text-xs text-muted-2 font-semibold">{p.orderCount} та заказ</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[13px] font-extrabold pt-1">
                    <span className="text-heading">Жами тушум</span>
                    <span className="text-success">{formatSom(totalIncome)}</span>
                  </div>

                  <div className="pt-3 border-t border-row-divider flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-extrabold text-heading">
                        Чиқим · {p.expenseCount} та ёзув
                      </span>
                      <span className="text-[13px] font-extrabold text-danger">−{formatSom(p.expenseTotal)}</span>
                    </div>
                    {p.expenseByCategory.map((c) => (
                      <div key={c.category} className="flex justify-between items-center pl-2">
                        <span className="text-xs font-semibold text-body">{c.category}</span>
                        <span className="text-xs font-bold text-muted-2">{formatSom(c.amount)}</span>
                      </div>
                    ))}
                    {p.expenseByCategory.length === 0 && (
                      <p className="text-xs text-muted-2">Бу даврда харажат ёзилмаган</p>
                    )}
                  </div>

                  {cashLedger &&
                    confirmReceiptAction &&
                    (() => {
                      const pointPending = cashLedger.pointPending.find((c) => c.point === p.point);
                      if (!pointPending || pointPending.pending.length === 0) return null;
                      return (
                        <div className="pt-3 border-t border-row-divider flex flex-col gap-2">
                          <div className="text-[13px] font-extrabold text-heading">Диспетчердан кутилмоқда</div>
                          {pointPending.pending.map((h) => (
                            <div key={h.id} className="flex items-center justify-between gap-2 bg-page rounded-xl p-2.5">
                              <div>
                                <div className="text-xs font-bold text-heading">{formatSom(h.amount)}</div>
                                <div className="text-[11px] text-muted-2 font-semibold">
                                  {h.dispatcherName} ·{" "}
                                  {h.handoverDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
                                </div>
                                {h.note && (
                                  <div className="text-[11px] text-danger font-semibold">Сабаб: {h.note}</div>
                                )}
                              </div>
                              <form action={confirmReceiptAction}>
                                <input type="hidden" name="id" value={h.id} />
                                <button
                                  type="submit"
                                  className="bg-success text-white rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap"
                                >
                                  Қабул қилдим ✓
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                </Card>
              );
            })}
          </div>
        )}

        {/* Combined cash-on-hand — not split by point since most of what
            it's spent on (salary, repairs, fuel-station bills, ...) isn't
            point-attributable either. Accountant-only. */}
        {cashLedger && (
          <Card className="p-6 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] text-muted-2 font-bold uppercase">
                  Эгасига берилмаган қолдиқ (харажатлардан кейин)
                </div>
                <div className="font-heading font-extrabold text-2xl text-heading">
                  {formatSom(cashLedger.balance)}
                </div>
                {cashLedger.openingBalance ? (
                  <div className="text-[11px] text-muted-2 font-semibold mt-1">
                    Бошланғич қолдиқ {formatSom(cashLedger.openingBalance.amount)} ·{" "}
                    {cashLedger.openingBalance.setDate.toLocaleDateString("uz-UZ", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    дан ҳисобланмоқда
                  </div>
                ) : (
                  <div className="text-[11px] text-danger font-semibold mt-1">
                    Бошланғич қолдиқ белгиланмаган — қолдиқ 0 деб кўрсатилмоқда
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {recordPayoutAction && cashLedger.balance > 0 && (
                  <OwnerPayoutForm balance={cashLedger.balance} action={recordPayoutAction} />
                )}
                {setOpeningBalanceAction && (
                  <CashOpeningBalanceForm
                    hasExisting={!!cashLedger.openingBalance}
                    action={setOpeningBalanceAction}
                  />
                )}
              </div>
            </div>
            <CashHistorySection
              confirmedHistory={cashLedger.confirmedHistory}
              payoutHistory={cashLedger.payoutHistory}
              revertReceiptAction={revertReceiptAction}
            />
          </Card>
        )}

        {/* Owner-only, read-only view of money already received. */}
        {ownerPayoutSummary && (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <div className="grid grid-cols-2 gap-4">
              <KpiCard label="Бу ой қабул қилинди" value={formatMillions(ownerPayoutSummary.thisMonth)} />
              <KpiCard label="Ўтган ой қабул қилинди" value={formatMillions(ownerPayoutSummary.lastMonth)} />
            </div>
            <Card className="p-6">
              <div className="font-heading font-bold text-base text-heading mb-4">
                Қабул қилинган пул · 6 ой динамикаси
              </div>
              <div className="flex items-end gap-4 h-[120px]">
                {ownerPayoutSummary.trend.map((t) => {
                  const max = Math.max(1, ...ownerPayoutSummary.trend.map((x) => x.amount));
                  return (
                    <div key={t.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div
                        className="w-[18px] rounded-t-md bg-primary"
                        style={{ height: `${(t.amount / max) * 100}%` }}
                        title={formatSom(t.amount)}
                      />
                      <div className="text-xs text-muted-2 font-bold">{t.label}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* Point vehicles — per-point income breakdown by vehicle. Expense/
            profit aren't shown here: a vehicle's repair/fuel cost isn't tied
            to a point (the shared fleet works both), so it can't be split
            correctly — that's why "Машиналар бўйича фойда" below stays
            combined and this table is income-only. */}
        {vm.pointVehicles.some((p) => p.rows.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {vm.pointVehicles.map((p) => (
              <Card key={p.point} className="overflow-hidden">
                <div className="px-5 py-4 font-heading font-bold text-base text-heading">
                  {POINT_LABELS[p.point]} машиналари · {vm.periodLabel}
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr_0.8fr_0.7fr] px-5 py-2 bg-page text-[11px] font-extrabold text-muted-2 uppercase tracking-wide">
                    <div>Машина</div>
                    <div>Ҳайдовчи</div>
                    <div>Рейс</div>
                    <div>Заказ</div>
                    <div>Тушум</div>
                    <div>Ҳолат</div>
                  </div>
                  {p.rows.map((r) => (
                    <div
                      key={r.vehicleId}
                      className="grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr_0.8fr_0.7fr] gap-x-1.5 px-5 py-2.5 border-t border-row-divider items-center text-xs"
                    >
                      <div className="bg-primary-tint rounded-md px-1.5 py-0.5 font-extrabold text-[10px] text-primary font-heading w-fit">
                        {r.plate}
                      </div>
                      <div className="text-body font-semibold truncate">{r.driverName}</div>
                      <div className="text-muted-2 font-bold">{r.tripCount}</div>
                      <div className="text-muted-2 font-bold">{r.orderCount}</div>
                      <div className="font-extrabold text-heading">{formatSom(r.income)}</div>
                      <div>
                        <StatusPill status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden">
                  {p.rows.map((r) => (
                    <div key={r.vehicleId} className="flex flex-col gap-1.5 px-5 py-3 border-t border-row-divider">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="bg-primary-tint rounded-md px-1.5 py-0.5 font-extrabold text-[10px] text-primary font-heading shrink-0">
                            {r.plate}
                          </div>
                          <span className="text-xs text-body font-semibold truncate">{r.driverName}</span>
                        </div>
                        <StatusPill status={r.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-2 font-semibold">
                          {r.tripCount} рейс · {r.orderCount} заказ
                        </span>
                        <span className="font-extrabold text-heading">{formatSom(r.income)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {p.rows.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Бу даврда маълумот йўқ</p>}
              </Card>
            ))}
          </div>
        )}

        {/* Orders list */}
        {vm.orders.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-6 py-[18px] font-heading font-bold text-base text-heading">
              Заказлар · {vm.periodLabel}
            </div>

            {/* Desktop */}
            <div className="hidden lg:grid grid-cols-[0.9fr_0.7fr_0.9fr_1.1fr_0.9fr_1.6fr] px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
              <div>Вақт</div>
              <div>Пункт</div>
              <div>Машина</div>
              <div>Ҳайдовчи</div>
              <div>Сумма</div>
              <div>Изоҳ</div>
            </div>
            {vm.orders.map((o) => (
              <div
                key={o.id}
                className="hidden lg:grid grid-cols-[0.9fr_0.7fr_0.9fr_1.1fr_0.9fr_1.6fr] gap-x-2 px-6 py-3 border-t border-row-divider items-center text-sm"
              >
                <div className="text-muted-2 font-bold">
                  {o.time.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} · {formatTime(o.time)}
                </div>
                <div>
                  <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full">
                    {POINT_LABELS[o.point]}
                  </span>
                </div>
                <div className="font-extrabold text-primary font-heading">{o.plate}</div>
                <div className="text-body font-semibold">{o.driverName}</div>
                <div className="font-extrabold text-heading">{formatSom(o.amount)}</div>
                <div className="text-muted-2 font-semibold break-words">{o.note ?? "—"}</div>
              </div>
            ))}

            {/* Mobile */}
            <div className="lg:hidden">
              {vm.orders.map((o) => (
                <div key={o.id} className="flex flex-col gap-1.5 px-5 py-3 border-t border-row-divider text-sm">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-2 font-bold text-xs">
                        {o.time.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} ·{" "}
                        {formatTime(o.time)}
                      </span>
                      <span className="bg-primary-tint text-primary text-xs font-extrabold px-2 py-0.5 rounded-full">
                        {POINT_LABELS[o.point]}
                      </span>
                    </div>
                    <span className="font-extrabold text-heading">{formatSom(o.amount)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-primary font-heading text-xs">{o.plate}</div>
                      <div className="text-body font-semibold text-xs">{o.driverName}</div>
                    </div>
                    {o.note && <div className="text-muted-2 text-xs font-semibold text-right">{o.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
