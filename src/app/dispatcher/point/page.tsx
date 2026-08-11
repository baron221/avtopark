import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { getActivePoint } from "@/lib/activePoint";
import { monthStart } from "@/lib/month";
import { getExternalVehicles } from "@/lib/externalVehicle";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import { IncomeForm } from "../journal/IncomeForm";
import { DriverTripsTable, type DriverGroup } from "./DriverTripsTable";
import {
  deleteTripAction,
  confirmCashHandoverAction,
  confirmCashHandoverWithAdjustmentAction,
  cancelCashHandoverAction,
} from "../actions";
import { HandoverForm } from "./HandoverForm";
import { CancelHandoverButton } from "./CancelHandoverButton";
import type { Point } from "@prisma/client";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function DispatcherPointPage({
  searchParams,
}: {
  searchParams: Promise<{ point?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  const guestAllowed = !isDispatcher && (await hasModuleAccess(session.user.role, "COLLECT_PAYMENT"));
  if (!isDispatcher && !guestAllowed) redirect("/coming-soon");

  const { point: pointParam } = await searchParams;
  const point: Point = isDispatcher
    ? await getActivePoint(session.user.point!)
    : pointParam === "QUVA"
      ? "QUVA"
      : "FARGONA";
  const today = new Date();
  const from = startOfDay(today);
  const to = endOfDay(today);
  const todayStr = today.toISOString().slice(0, 10);
  const monthStartStr = monthStart(today).toISOString().slice(0, 10);

  const staffExpensePoint = point === "FARGONA" ? "FARGONA" : "QUVA";

  const [
    vehicles,
    tripsToday,
    otherIncomeToday,
    myExpenseAgg,
    myLunch,
    baseFareRoute,
    todaysHandover,
    pointExpenseAgg,
    pointLunchAgg,
    externalVehicles,
  ] = await Promise.all([
    // The fleet is shared between both points (the same vehicles shuttle
    // Farg'ona <-> Quva), so every point's dispatcher picks from the whole
    // active fleet rather than a per-point subset.
    prisma.vehicle.findMany({
      where: { status: { in: DISPATCHABLE_STATUSES } },
      include: { driver: { include: { user: true } } },
      orderBy: { plate: "asc" },
    }),
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to }, point },
      include: { vehicle: true, driver: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.otherIncome.findMany({ where: { point, incomeDate: { gte: from, lte: to } }, orderBy: { createdAt: "asc" } }),
    prisma.staffExpense.aggregate({
      _sum: { amount: true },
      where: { userId: session.user.id, expenseDate: { gte: from, lte: to } },
    }),
    prisma.lunch.findUnique({ where: { userId_lunchDate: { userId: session.user.id, lunchDate: from } } }),
    prisma.route.findFirst({ where: { isActive: true } }),
    prisma.cashHandover.findUnique({ where: { point_handoverDate: { point, handoverDate: from } } }),
    // Point-wide (not just this dispatcher's own) — matches exactly what
    // confirmCashHandoverAction nets out, so this display never disagrees
    // with what clicking "Топшириш" actually records.
    prisma.staffExpense.aggregate({
      _sum: { amount: true },
      where: { point: staffExpensePoint, expenseDate: { gte: from, lte: to } },
    }),
    prisma.lunch.aggregate({ _sum: { amount: true }, where: { point, lunchDate: { gte: from, lte: to } } }),
    getExternalVehicles(),
  ]);

  const otherIncomeTotal = otherIncomeToday.reduce((s, i) => s + Number(i.amount), 0);
  const collectedToday = tripsToday.reduce((s, t) => s + Number(t.revenue), 0) + otherIncomeTotal;
  const vehiclesWithMoney = new Set(tripsToday.map((t) => t.vehicleId));
  const myExpenseToday = Number(myExpenseAgg._sum.amount ?? BigInt(0));
  const myLunchToday = myLunch ? Number(myLunch.amount) : 0;
  const pointChiqimToday = Number(pointExpenseAgg._sum.amount ?? BigInt(0)) + Number(pointLunchAgg._sum.amount ?? BigInt(0));
  const netToHandover = Math.max(0, collectedToday - pointChiqimToday);

  const deletePoint = isDispatcher ? undefined : point;

  // One row per driver who worked today, each expandable to their individual
  // trips — a flat per-trip list got unreadably long once a driver had made
  // several runs in a day.
  const groupsByDriver = new Map<string, DriverGroup>();
  for (const t of tripsToday) {
    const detail = {
      id: t.id,
      time: t.createdAt,
      label: t.kind === "ORDER" ? "Алоҳида заказ" : t.tripNumber ? `${t.tripNumber}-рейс` : "Рейс",
      amount: Number(t.revenue),
      editHref: `/dispatcher/trips/${t.id}/edit?from=point${isDispatcher ? "" : `&point=${point}`}`,
    };
    const existing = groupsByDriver.get(t.driverId);
    if (existing) {
      existing.trips.push(detail);
      existing.totalAmount += detail.amount;
      existing.plate = t.vehicle.plate;
    } else {
      groupsByDriver.set(t.driverId, {
        driverId: t.driverId,
        driverName: t.driver.user.fullName,
        plate: t.vehicle.plate,
        totalAmount: detail.amount,
        trips: [detail],
      });
    }
  }
  // Most recently active driver on top.
  const driverGroups = Array.from(groupsByDriver.values()).sort(
    (a, b) => b.trips[b.trips.length - 1].time.getTime() - a.trips[a.trips.length - 1].time.getTime()
  );

  const vehicleOptions = vehicles
    .filter((v) => v.driver)
    .map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver!.user.fullName }));

  const pointLabel = point === "FARGONA" ? "Фарғона" : "Қува";

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            {pointLabel} пункти · {today.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {session.user.name} · келган ҳар машинадан пул қабул қилинади
          </div>
        </div>
        {!isDispatcher && (
          <div className="flex gap-2">
            <Link
              href="/dispatcher/point?point=FARGONA"
              className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                point === "FARGONA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
              }`}
            >
              Фарғона
            </Link>
            <Link
              href="/dispatcher/point?point=QUVA"
              className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                point === "QUVA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
              }`}
            >
              Қува
            </Link>
          </div>
        )}
      </div>

      <div className="max-w-[420px] w-full">
        <IncomeForm
          vehicles={vehicleOptions}
          baseFare={baseFareRoute?.baseFare ?? 20000}
          point={isDispatcher ? undefined : point}
          todayStr={todayStr}
          monthStartStr={monthStartStr}
          externalVehiclePlates={externalVehicles.map((v) => v.plate)}
        />
        <p className="text-xs text-muted-2 font-semibold text-center pt-3">
          Расход ва обед қўшиш учун{" "}
          <Link href="/dispatcher/journal" className="text-primary font-extrabold hover:underline">
            Журнал
          </Link>{" "}
          бўлимига ўтинг
        </p>
      </div>

      <Card className="overflow-hidden">
        <DriverTripsTable groups={driverGroups} deleteAction={deleteTripAction} deletePoint={deletePoint} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard variant="primary" label="Бугун йиғилди" value={formatSom(collectedToday)} />
        <KpiCard label="Қабул қилинган машина" value={`${vehiclesWithMoney.size} / ${vehicles.length}`} />
        <KpiCard label="Менинг расходим (бугун)" value={`−${formatSom(myExpenseToday)}`} hintColor="danger" />
        <KpiCard label="Обед" value={myLunchToday ? `−${formatSom(myLunchToday)}` : "—"} />
      </div>

      <Card className="p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-[15px] text-heading">Кунлик пул топшириш</div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {todaysHandover
              ? `Топширилган сумма: ${formatSom(Number(todaysHandover.amount))}`
              : pointChiqimToday > 0
                ? `Йиғилди ${formatSom(collectedToday)} − расход ${formatSom(pointChiqimToday)} = ${formatSom(netToHandover)}`
                : `Бугун йиғилган: ${formatSom(netToHandover)}`}
          </div>
          {todaysHandover?.note && (
            <div className="text-[12px] text-danger font-semibold mt-0.5">Сабаб: {todaysHandover.note}</div>
          )}
        </div>
        {!todaysHandover && netToHandover > 0 && (
          <HandoverForm
            point={!isDispatcher ? point : undefined}
            computedAmount={netToHandover}
            action={confirmCashHandoverAction}
            adjustAction={confirmCashHandoverWithAdjustmentAction}
          />
        )}
        {todaysHandover && !todaysHandover.accountantConfirmedAt && (
          <div className="flex items-center gap-2.5">
            <span className="bg-primary-tint text-primary text-xs font-extrabold px-3 py-1.5 rounded-full whitespace-nowrap">
              Буxгалтер тасдиғини кутмоқда
            </span>
            <CancelHandoverButton action={cancelCashHandoverAction} point={!isDispatcher ? point : undefined} />
          </div>
        )}
        {todaysHandover?.accountantConfirmedAt && (
          <span className="bg-success/10 text-success text-xs font-extrabold px-3 py-1.5 rounded-full">
            ✓ Буxгалтер қабул қилди
          </span>
        )}
      </Card>
    </div>
  );
}
