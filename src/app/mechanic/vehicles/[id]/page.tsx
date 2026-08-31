import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { formatSom } from "@/lib/format";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { getVehicleReport } from "@/lib/vehicleReport";
import { getDriverAssignmentHistory } from "@/lib/driverAssignment";
import { getWialonUnitByPlate, getWialonMileageToday, type WialonUnit } from "@/lib/wialon";
import { estimateCurrentOdometerKm } from "@/lib/oilChange";
import { monthStart as toMonthStart, monthEnd as toMonthEnd } from "@/lib/month";
import { hasModuleAccess } from "@/lib/access";
import { StatusSelect } from "./StatusSelect";
import { ExpenseForm } from "./ExpenseForm";
import { DriverSelect } from "./DriverSelect";
import { AddDriverForm } from "./AddDriverForm";
import { OilChangeForm } from "./OilChangeForm";
import { MonthlyFuelCardContent } from "./MonthlyFuelCardContent";

// Viewing a past month with no cached VehicleMileage data falls back to one
// live Wialon range query, observed to take ~10-14s against the self-hosted
// server — comfortably over the platform's default serverless timeout.
export const maxDuration = 30;

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const FUEL_MONTH_RE = /^\d{4}-\d{2}$/;

function parseFuelMonthParam(value: string | undefined): Date {
  if (value && FUEL_MONTH_RE.test(value)) {
    const [y, m] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, 1));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return toMonthStart(new Date());
}

const CATEGORY_LABELS: Record<string, string> = {
  FUEL: "Ёқилғи",
  REPAIR: "Таъмирлаш",
  SALARY: "Маош",
  INSURANCE: "Суғурта",
  TAX: "Солиқ",
  TOLL: "Йўл ҳақи",
  OTHER: "Бошқа",
};

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; fuelMonth?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) redirect("/coming-soon");

  const { id } = await params;
  const { period: periodParam, fuelMonth: fuelMonthParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const fuelMonth = parseFuelMonthParam(fuelMonthParam);
  const fuelMonthStr = `${fuelMonth.getUTCFullYear()}-${String(fuelMonth.getUTCMonth() + 1).padStart(2, "0")}`;

  const [vehicle, vm, expenses, drivers, oilChanges, report, assignmentHistory, mileageHistory] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id }, include: { driver: { include: { user: true } } } }),
    getOwnerDashboardVM("MONTH"),
    prisma.expense.findMany({ where: { vehicleId: id }, orderBy: { expenseDate: "desc" }, take: 10 }),
    prisma.driver.findMany({ include: { user: true, vehicle: true }, orderBy: { user: { fullName: "asc" } } }),
    prisma.oilChange.findMany({ where: { vehicleId: id }, orderBy: { changedAt: "desc" }, take: 10 }),
    getVehicleReport(id, period),
    getDriverAssignmentHistory(id),
    prisma.vehicleMileage.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 30 }),
  ]);

  if (!vehicle) notFound();

  const last7Days = mileageHistory.slice(0, 7);
  const weekKm = last7Days.reduce((s, m) => s + m.km, 0);
  const monthKm = mileageHistory.reduce((s, m) => s + m.km, 0);
  const maxDayKm = Math.max(1, ...last7Days.map((m) => m.km));

  const lastOilChange = oilChanges[0] ?? null;
  // The last real reading we know of — from the last oil change if there's
  // been one, otherwise the vehicle's own odometerKm (dated from purchase,
  // a rough base but VehicleMileage only has rows from when GPS tracking
  // started anyway, so summing "since" it is safe either way).
  const oilBase = lastOilChange
    ? { km: lastOilChange.odometerKm, date: lastOilChange.changedAt }
    : vehicle.odometerKm != null
      ? { km: vehicle.odometerKm, date: vehicle.purchaseDate }
      : null;

  type GpsBundle = { unit: WialonUnit | null; mileageToday: number | null };

  // This page was slow to open for two stacked reasons, both fixed here:
  // (1) estimateCurrentOdometerKm doesn't touch Wialon at all, but used to
  // be awaited strictly *after* the GPS lookup below instead of alongside
  // it. (2) The monthly fuel report (rendered further down, inside its own
  // <Suspense> now) falls back to a live Wialon range query whenever a
  // month's daily VehicleMileage snapshots have gaps — its own doc comment
  // says that can take ~10s against the self-hosted server — so it's kept
  // fully out of this page's critical path rather than merely reordered.
  const fuelRangeTo = fuelMonth.getTime() === toMonthStart(new Date()).getTime() ? new Date() : toMonthEnd(fuelMonth);
  const [gpsBundle, estimatedOdometerKm] = await Promise.all([
    (async (): Promise<GpsBundle> => {
      try {
        const unit = await getWialonUnitByPlate(vehicle.plate);
        if (!unit) return { unit: null, mileageToday: null };
        const mileageToday = await getWialonMileageToday(unit.id);
        return { unit, mileageToday };
      } catch (err) {
        console.error("Wialon GPS xato:", err);
        return { unit: null, mileageToday: null };
      }
    })(),
    oilBase ? estimateCurrentOdometerKm(vehicle.id, oilBase.km, oilBase.date) : Promise.resolve(null),
  ]);
  const gpsUnit = gpsBundle.unit;
  const gpsMileageToday = gpsBundle.mileageToday;

  // Approaching due (within 500km or 7 days) gets its own "yellow" tier so a
  // mechanic sees it coming instead of the status jumping straight from
  // "fine" to "overdue" with no lead time to actually schedule the change.
  const OIL_WARNING_KM = 500;
  const OIL_WARNING_DAYS = 7;
  let oilStatus: { level: "OK" | "WARNING" | "OVERDUE"; kmRemaining: number; daysRemaining: number } | null = null;
  if (lastOilChange) {
    const nextDueKm = lastOilChange.odometerKm + lastOilChange.intervalKm;
    const nextDueDate = new Date(lastOilChange.changedAt);
    nextDueDate.setMonth(nextDueDate.getMonth() + lastOilChange.intervalMonths);
    const currentKm = estimatedOdometerKm ?? vehicle.odometerKm ?? lastOilChange.odometerKm;
    const kmRemaining = nextDueKm - currentKm;
    const daysRemaining = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / 86_400_000);
    const overdue = kmRemaining <= 0 || daysRemaining <= 0;
    const nearing = kmRemaining <= OIL_WARNING_KM || daysRemaining <= OIL_WARNING_DAYS;
    oilStatus = { level: overdue ? "OVERDUE" : nearing ? "WARNING" : "OK", kmRemaining, daysRemaining };
  }

  const row = vm.vehicles.find((v) => v.vehicleId === id);
  const driverOptions = drivers.map((d) => ({
    id: d.id,
    name: d.user.fullName,
    currentPlate: d.vehicle?.plate ?? null,
  }));

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3.5 flex-wrap">
          <Link href="/mechanic/vehicles" className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors">
            ← Машиналар
          </Link>
          <div className="font-heading font-bold text-xl text-heading">
            {vehicle.plate} · {vehicle.model}
          </div>
          <StatusSelect vehicleId={vehicle.id} status={vehicle.status} />
          <Link
            href={`/mechanic/vehicles/${vehicle.id}/edit`}
            className="bg-page text-heading text-xs font-extrabold px-3 py-1.5 rounded-lg border border-border"
          >
            Таҳрирлаш
          </Link>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DriverSelect vehicleId={vehicle.id} currentDriverId={vehicle.driver?.id ?? null} drivers={driverOptions} />
          <AddDriverForm vehicleId={vehicle.id} />
        </div>
      </div>

      {assignmentHistory.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-3.5 font-heading font-bold text-base text-heading">Ҳайдовчилар тарихи</div>
          {assignmentHistory.map((a, i) => (
            <div
              key={i}
              className="flex justify-between items-center px-6 py-2.5 border-t border-row-divider text-sm gap-2"
            >
              <div className="font-bold text-heading">{a.driverName}</div>
              <div className="text-muted-2 font-semibold text-xs">
                {a.startedAt.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
                {" – "}
                {a.endedAt
                  ? a.endedAt.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })
                  : "ҳозиргача"}
              </div>
            </div>
          ))}
        </Card>
      )}

      {gpsUnit && (
        <Card className="overflow-hidden">
          <div className="flex justify-between items-center px-6 py-3.5 flex-wrap gap-2">
            <div className="font-heading font-bold text-base text-heading">GPS</div>
            <a
              href={`https://www.google.com/maps?q=${gpsUnit.lat},${gpsUnit.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-extrabold text-xs hover:underline"
            >
              Харитада кўриш ↗
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 px-6 pb-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-2 font-bold">Тезлик</div>
              <div className={`font-extrabold ${gpsUnit.speedKmh > 0 ? "text-success" : "text-muted-2"}`}>
                {gpsUnit.speedKmh > 0 ? `${gpsUnit.speedKmh} км/соат` : "тўхтаган"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-2 font-bold">Бугун босиб ўтган</div>
              <div className="font-extrabold text-heading">
                {gpsMileageToday !== null ? `${gpsMileageToday.toFixed(0)} км` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-2 font-bold">Сўнгги алоқа</div>
              <div className="font-extrabold text-heading">
                {gpsUnit.lastUpdate.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-2 font-bold">Бу ҳафта</div>
              <div className="font-extrabold text-heading">{weekKm.toFixed(0)} км</div>
            </div>
            <div>
              <div className="text-xs text-muted-2 font-bold">Бу ой</div>
              <div className="font-extrabold text-heading">{monthKm.toFixed(0)} км</div>
            </div>
          </div>
          {last7Days.length > 0 && (
            <div className="px-6 pb-5 flex items-end gap-2 h-16">
              {[...last7Days].reverse().map((m) => (
                <div key={m.id} className="flex-1 flex flex-col items-center gap-1" title={`${m.km.toFixed(0)} км`}>
                  <div
                    className="w-full bg-primary rounded-t"
                    style={{ height: `${Math.max(4, (m.km / maxDayKm) * 40)}px` }}
                  />
                  <div className="text-[10px] text-muted-2 font-bold">
                    {m.date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {gpsUnit && (
        <Card className="overflow-hidden">
          <div className="flex justify-between items-center px-6 py-3.5 flex-wrap gap-2">
            <div>
              <div className="font-heading font-bold text-base text-heading">Ойлик ёқилғи ва масофа</div>
              <div className="text-xs text-muted-2 font-semibold mt-0.5">
                Шу ойда қуйилган ёқилғи (турлар бўйича) ва GPS орқали босиб ўтилган масофа
              </div>
            </div>
            <MonthPicker
              basePath={`/mechanic/vehicles/${vehicle.id}`}
              value={fuelMonthStr}
              paramName="fuelMonth"
              extraParams={{ period }}
            />
          </div>
          <Suspense
            fallback={<p className="text-[13px] text-muted-2 px-6 pb-5">Юкланмоқда…</p>}
            key={`${fuelMonthStr}-${fuelRangeTo.getTime()}`}
          >
            <MonthlyFuelCardContent
              vehicleId={vehicle.id}
              unitId={gpsUnit.id}
              fuelMonth={fuelMonth}
              fuelRangeTo={fuelRangeTo}
            />
          </Suspense>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={`Тушум · ${vm.periodLabel}`} value={formatSom(row?.income ?? 0)} />
        <KpiCard label={`Харажат · ${vm.periodLabel}`} value={formatSom(row?.expense ?? 0)} hintColor="danger" />
        <KpiCard variant="primary" label={`Соф фойда · ${vm.periodLabel}`} value={formatSom(row?.profit ?? 0)} />
        <KpiCard label={`Рейслар · ${vm.periodLabel}`} value={String(row?.tripCount ?? 0)} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex justify-between items-center px-6 py-3.5">
          <div className="font-heading font-bold text-base text-heading">Охирги харажатлар</div>
        </div>
        <div className="px-6 pb-4">
          <ExpenseForm vehicleId={vehicle.id} />
        </div>
        {expenses.map((e) => (
          <div
            key={e.id}
            className="grid grid-cols-[0.6fr_0.9fr_2fr_1fr] px-6 py-3 border-t border-row-divider items-center text-sm gap-2"
          >
            <div className="text-muted-2 font-bold">
              {e.expenseDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
            </div>
            <div>
              <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full">
                {CATEGORY_LABELS[e.category] ?? e.category}
              </span>
            </div>
            <div className="text-body font-semibold">{e.note ?? "—"}</div>
            <div className="font-extrabold text-heading text-right">−{formatSom(Number(e.amount))}</div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳали харажат йўқ</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex justify-between items-center px-6 py-3.5 flex-wrap gap-2">
          <div>
            <div className="font-heading font-bold text-base text-heading">Мой алмаштириш</div>
            {estimatedOdometerKm != null && (
              <div className="text-[11px] text-muted-2 font-semibold mt-0.5">
                GPS орқали тахминан: {estimatedOdometerKm.toLocaleString("uz-UZ")} км
              </div>
            )}
          </div>
          {oilStatus && (
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                oilStatus.level === "OVERDUE"
                  ? "bg-danger-tint text-danger"
                  : oilStatus.level === "WARNING"
                    ? "bg-warning-tint text-warning"
                    : "bg-success-tint text-success"
              }`}
            >
              {oilStatus.level === "OVERDUE"
                ? "Муддати ўтган"
                : `${Math.max(0, oilStatus.kmRemaining).toLocaleString("uz-UZ")} км / ${Math.max(0, oilStatus.daysRemaining)} кун қолди`}
            </span>
          )}
        </div>
        <div className="px-6 pb-4">
          <OilChangeForm vehicleId={vehicle.id} lastOdometerKm={vehicle.odometerKm} estimatedOdometerKm={estimatedOdometerKm} />
        </div>
        {oilChanges.map((o) => (
          <div
            key={o.id}
            className="grid grid-cols-[0.6fr_0.9fr_2fr_1fr] px-6 py-3 border-t border-row-divider items-center text-sm gap-2"
          >
            <div className="text-muted-2 font-bold">
              {o.changedAt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
            </div>
            <div className="text-body font-semibold">{o.odometerKm.toLocaleString("uz-UZ")} км</div>
            <div className="text-muted-2 text-xs font-semibold">{o.note ?? "—"}</div>
            <div className="font-extrabold text-heading text-right">−{formatSom(Number(o.amount))}</div>
          </div>
        ))}
        {oilChanges.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳали мой алмаштирилмаган</p>}
      </Card>

      {report && (
        <Card className="overflow-hidden">
          <div className="flex justify-between items-center px-6 py-3.5 flex-wrap gap-3">
            <div>
              <div className="font-heading font-bold text-base text-heading">
                {report.plate}
                {report.driverName ? ` · ${report.driverName}` : ""}
              </div>
              <div className="text-xs text-muted-2 font-semibold">
                {report.rangeLabel} · {report.tripCount} рейс
                {report.orderCount > 0 ? ` · ${report.orderCount} заказ` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PeriodToggle
                active={period}
                basePath={`/mechanic/vehicles/${vehicle.id}`}
                extraParams={{ fuelMonth: fuelMonthStr }}
              />
              <a
                href={`/print/vehicle/${vehicle.id}?period=${period}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-page border border-border text-heading text-xs font-extrabold px-3 py-2 rounded-lg hover:border-primary hover:text-primary transition-colors"
              >
                🖨 Чоп этиш
              </a>
            </div>
          </div>
          <div className="hidden lg:grid grid-cols-[2fr_1fr] px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
            <div>Мақсад</div>
            <div className="text-right">Сумма</div>
          </div>
          {report.expenseLines.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_1fr] px-6 py-2.5 border-t border-row-divider items-center text-sm"
            >
              <div className="text-body font-semibold">{l.label}</div>
              <div className="font-bold text-heading text-right">{formatSom(l.amount)}</div>
            </div>
          ))}
          {report.expenseLines.length === 0 && (
            <p className="text-[13px] text-muted-2 px-6 py-4">Бу даврда харажат ёзилмаган</p>
          )}
          <div className="grid grid-cols-[2fr_1fr] px-6 py-3 border-t-2 border-danger bg-danger-tint items-center text-sm">
            <div className="font-extrabold text-danger">Жами харажат</div>
            <div className="font-extrabold text-danger text-right">{formatSom(report.totalExpense)}</div>
          </div>
          <div className="grid grid-cols-[2fr_1fr] px-6 py-3 border-t border-row-divider bg-success-tint items-center text-sm">
            <div className="font-extrabold text-success">{report.rangeLabel} тушум</div>
            <div className="font-extrabold text-success text-right">{formatSom(report.income)}</div>
          </div>
          <div className="grid grid-cols-[2fr_1fr] px-6 py-3.5 border-t border-row-divider items-center">
            <div className="font-heading font-extrabold text-heading">Фойда</div>
            <div
              className={`font-heading font-extrabold text-right ${report.profit >= 0 ? "text-heading" : "text-danger"}`}
            >
              {formatSom(report.profit)}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
