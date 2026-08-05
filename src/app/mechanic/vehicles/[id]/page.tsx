import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { formatSom } from "@/lib/format";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { getVehicleReport } from "@/lib/vehicleReport";
import { getDriverAssignmentHistory } from "@/lib/driverAssignment";
import { getWialonUnitByPlate, getWialonMileageToday, type WialonUnit } from "@/lib/wialon";
import { hasModuleAccess } from "@/lib/access";
import { StatusSelect } from "./StatusSelect";
import { ExpenseForm } from "./ExpenseForm";
import { DriverSelect } from "./DriverSelect";
import { AddDriverForm } from "./AddDriverForm";
import { OilChangeForm } from "./OilChangeForm";

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
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
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) redirect("/coming-soon");

  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";

  const [vehicle, vm, expenses, drivers, oilChanges, report, assignmentHistory] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id }, include: { driver: { include: { user: true } } } }),
    getOwnerDashboardVM("MONTH"),
    prisma.expense.findMany({ where: { vehicleId: id }, orderBy: { expenseDate: "desc" }, take: 10 }),
    prisma.driver.findMany({ include: { user: true, vehicle: true }, orderBy: { user: { fullName: "asc" } } }),
    prisma.oilChange.findMany({ where: { vehicleId: id }, orderBy: { changedAt: "desc" }, take: 10 }),
    getVehicleReport(id, period),
    getDriverAssignmentHistory(id),
  ]);

  if (!vehicle) notFound();

  let gpsUnit: WialonUnit | null = null;
  let gpsMileageToday: number | null = null;
  try {
    gpsUnit = await getWialonUnitByPlate(vehicle.plate);
    if (gpsUnit) gpsMileageToday = await getWialonMileageToday(gpsUnit.id);
  } catch (err) {
    console.error("Wialon GPS xato:", err);
    gpsUnit = null;
  }

  const lastOilChange = oilChanges[0] ?? null;
  let oilStatus: { overdue: boolean; kmRemaining: number; daysRemaining: number } | null = null;
  if (lastOilChange) {
    const nextDueKm = lastOilChange.odometerKm + lastOilChange.intervalKm;
    const nextDueDate = new Date(lastOilChange.changedAt);
    nextDueDate.setMonth(nextDueDate.getMonth() + lastOilChange.intervalMonths);
    const currentKm = vehicle.odometerKm ?? lastOilChange.odometerKm;
    const kmRemaining = nextDueKm - currentKm;
    const daysRemaining = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / 86_400_000);
    oilStatus = { overdue: kmRemaining <= 0 || daysRemaining <= 0, kmRemaining, daysRemaining };
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
          <div className="grid grid-cols-3 px-6 pb-4 gap-3 text-sm">
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
          </div>
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
          <div className="font-heading font-bold text-base text-heading">Мой алмаштириш</div>
          {oilStatus && (
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                oilStatus.overdue ? "bg-danger-tint text-danger" : "bg-success-tint text-success"
              }`}
            >
              {oilStatus.overdue
                ? "Муддати ўтган"
                : `${Math.max(0, oilStatus.kmRemaining).toLocaleString("uz-UZ")} км / ${Math.max(0, oilStatus.daysRemaining)} кун қолди`}
            </span>
          )}
        </div>
        <div className="px-6 pb-4">
          <OilChangeForm vehicleId={vehicle.id} lastOdometerKm={vehicle.odometerKm} />
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
              <PeriodToggle active={period} basePath={`/mechanic/vehicles/${vehicle.id}`} />
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
