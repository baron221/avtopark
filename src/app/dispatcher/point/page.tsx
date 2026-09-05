import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { getActivePoint } from "@/lib/activePoint";
import { getExternalVehicles } from "@/lib/externalVehicle";
import { getVehiclesAndDrivers } from "@/lib/vehicleWithDriver";
import { computeDailyCashBreakdown, getPointDayContributions } from "@/lib/cashHandover";
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
import { PointContributions } from "./PointContributions";
import { DatePicker } from "@/components/ui/DatePicker";
import type { Point } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  searchParams: Promise<{ point?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  const guestAllowed = !isDispatcher && (await hasModuleAccess(session.user.role, "COLLECT_PAYMENT"));
  if (!isDispatcher && !guestAllowed) redirect("/coming-soon");

  const { point: pointParam, date: dateParam } = await searchParams;
  const point: Point = isDispatcher
    ? await getActivePoint(session.user.id, session.user.point!)
    : pointParam === "QUVA"
      ? "QUVA"
      : "FARGONA";
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayStr = now.toISOString().slice(0, 10);

  // A dispatcher isn't only ever looking at today — they might be catching
  // up on a day they missed (see "Топшириш" below) or reviewing any past
  // month — so this whole page can show any past day, not just today.
  // Falls back to today for anything missing/invalid/in the future.
  let viewDate = now;
  if (dateParam && DATE_RE.test(dateParam)) {
    const parsed = new Date(`${dateParam}T12:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed <= endOfDay(now)) {
      viewDate = parsed;
    }
  }
  const from = startOfDay(viewDate);
  const to = endOfDay(viewDate);
  const viewDateStr = from.toISOString().slice(0, 10);
  const isToday = from.getTime() === todayStart.getTime();

  const [
    { vehicles: allVehicles, drivers },
    tripsToday,
    otherIncomeToday,
    myExpenseAgg,
    baseFareRoute,
    handoversToday,
    pointLunchAgg,
    externalVehicles,
    myBreakdown,
    contributions,
  ] = await Promise.all([
    // Two flat queries joined in JS (see getVehiclesAndDrivers) instead of
    // vehicle.findMany's own doubly-nested include — measured far faster
    // against this project's high-latency DB region (see dashboard.ts's own
    // comment on the same fix). The fleet is shared between both points
    // (the same vehicles shuttle Farg'ona <-> Quva), so every point's
    // dispatcher picks from the whole active fleet rather than a per-point
    // subset — filtered/sorted below instead of in the query.
    getVehiclesAndDrivers(),
    // select, not include: vehicle plate / driver name are resolved below
    // from allVehicles/drivers instead, so this stays a single flat query.
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to }, point },
      select: { id: true, createdAt: true, kind: true, tripNumber: true, revenue: true, driverId: true, vehicleId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.otherIncome.findMany({ where: { point, incomeDate: { gte: from, lte: to } }, orderBy: { createdAt: "asc" } }),
    prisma.staffExpense.aggregate({
      _sum: { amount: true },
      where: { userId: session.user.id, expenseDate: { gte: from, lte: to } },
    }),
    prisma.route.findFirst({ where: { isActive: true } }),
    // Every handover for this point/day, not just this dispatcher's own —
    // dispatchers rotate shifts, so more than one can exist (see
    // CashHandover's widened unique key). myHandover below picks this
    // dispatcher's own row out of the set; the rest feed PointContributions.
    prisma.cashHandover.findMany({
      where: { point, handoverDate: from },
      include: { dispatcherConfirmedByUser: true },
    }),
    // Point-wide (not just this dispatcher's own) — deliberately still
    // pooled for the "Обед (пункт)" KPI below, which answers "what
    // happened at this point today" for a rotating dispatcher's context,
    // unlike myBreakdown below which is what THIS dispatcher must
    // personally hand over.
    prisma.lunch.aggregate({ _sum: { amount: true }, where: { point, lunchDate: { gte: from, lte: to } } }),
    getExternalVehicles(),
    // This dispatcher's own collected/spent/net for this point/day — the
    // same formula createHandoverForDate uses to compute the actual
    // handover amount, so this display never disagrees with what clicking
    // "Топшираман" actually records (see computeDailyCashBreakdown).
    computeDailyCashBreakdown(point, from, session.user.id),
    // Every dispatcher (not just this one) who had any activity at this
    // point/day, for the "Бугун ким қанча йиғди" panel below.
    getPointDayContributions(point, from),
  ]);

  // Filtered/sorted here instead of in the query — see getVehiclesAndDrivers.
  const vehicles = allVehicles
    .filter((v) => DISPATCHABLE_STATUSES.includes(v.status))
    .sort((a, b) => a.plate.localeCompare(b.plate));
  const vehicleById = new Map(allVehicles.map((v) => [v.id, v]));
  // Keyed by driverId, not vehicleId — a trip's driverId is whoever actually
  // made *that* trip, which can differ from the vehicle's *current* driver
  // after a reassignment (see getVehiclesAndDrivers's own comment).
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  const otherIncomeTotal = otherIncomeToday.reduce((s, i) => s + Number(i.amount), 0);
  const collectedToday = tripsToday.reduce((s, t) => s + Number(t.revenue), 0) + otherIncomeTotal;
  const vehiclesWithMoney = new Set(tripsToday.map((t) => t.vehicleId));
  const myExpenseToday = Number(myExpenseAgg._sum.amount ?? BigInt(0));
  const pointLunchToday = Number(pointLunchAgg._sum.amount ?? BigInt(0));
  // What THIS dispatcher personally must hand over — see
  // computeDailyCashBreakdown's own comment. Deliberately not derived from
  // the pooled collectedToday/pointLunchToday above (those stay pooled,
  // for the KPI row's "what happened here today" context).
  const myCollected = Number(myBreakdown.collected);
  const mySpent = Number(myBreakdown.spent);
  const myNet = Number(myBreakdown.net);
  const myHandover = handoversToday.find((h) => h.dispatcherConfirmedBy === session.user.id) ?? null;
  const contributionRows = contributions.map((c) => ({
    dispatcherId: c.dispatcherId,
    dispatcherName: c.dispatcherName,
    amount: Number(c.amount),
    submitted: handoversToday.some((h) => h.dispatcherConfirmedBy === c.dispatcherId),
  }));

  const deletePoint = isDispatcher ? undefined : point;

  // One row per driver who worked today, each expandable to their individual
  // trips — a flat per-trip list got unreadably long once a driver had made
  // several runs in a day.
  const groupsByDriver = new Map<string, DriverGroup>();
  for (const t of tripsToday) {
    const plate = vehicleById.get(t.vehicleId)?.plate ?? "—";
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
      existing.plate = plate;
    } else {
      groupsByDriver.set(t.driverId, {
        driverId: t.driverId,
        driverName: driverById.get(t.driverId)?.user.fullName ?? "—",
        plate,
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
            {pointLabel} пункти · {viewDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
            {!isToday && <span className="text-primary"> (ўтган кун)</span>}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {session.user.name} · келган ҳар машинадан пул қабул қилинади
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker
            basePath="/dispatcher/point"
            value={viewDateStr}
            extraParams={!isDispatcher ? { point } : undefined}
          />
          {!isDispatcher && (
            <div className="flex gap-2">
              <Link
                href={`/dispatcher/point?point=FARGONA&date=${viewDateStr}`}
                className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                  point === "FARGONA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
                }`}
              >
                Фарғона
              </Link>
              <Link
                href={`/dispatcher/point?point=QUVA&date=${viewDateStr}`}
                className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                  point === "QUVA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
                }`}
              >
                Қува
              </Link>
            </div>
          )}
        </div>
      </div>

      {isDispatcher && (
        <div className="max-w-[420px] w-full">
          <IncomeForm
            vehicles={vehicleOptions}
            baseFare={baseFareRoute?.baseFare ?? 20000}
            point={undefined}
            todayStr={todayStr}
            defaultDateStr={viewDateStr}
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
      )}

      <Card className="overflow-hidden">
        <DriverTripsTable groups={driverGroups} deleteAction={deleteTripAction} deletePoint={deletePoint} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard variant="primary" label={isToday ? "Бугун йиғилди" : "Йиғилди"} value={formatSom(collectedToday)} />
        <KpiCard label="Қабул қилинган машина" value={`${vehiclesWithMoney.size} / ${vehicles.length}`} />
        <KpiCard
          label={isToday ? "Менинг расходим (бугун)" : "Менинг расходим"}
          value={`−${formatSom(myExpenseToday)}`}
          hintColor="danger"
        />
        <KpiCard
          label={isToday ? "Обед (бугун, пункт)" : "Обед (пункт)"}
          value={pointLunchToday ? `−${formatSom(pointLunchToday)}` : "—"}
        />
      </div>

      <Card className="p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-[15px] text-heading">
            Менинг кунлик пул топширишим{!isToday && ` · ${viewDateStr}`}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {myHandover
              ? // myNet is this dispatcher's own live kirim−chiqim for this
                // point/day (computeDailyCashBreakdown, just above) — used
                // here instead of the frozen myHandover.amount so a trip/
                // expense edited after "Топшираман" was clicked still shows
                // up immediately, rather than only reaching the owner's
                // balance invisibly (see computeDailyCashAmounts's own
                // comment on why the frozen column goes stale). A real
                // accountant physical recount (confirmedAmount) still wins
                // over either figure.
                `Топширилган сумма: ${formatSom(Number(myHandover.confirmedAmount ?? myNet))}`
              : mySpent > 0
                ? `Йиғилди ${formatSom(myCollected)} − расход ${formatSom(mySpent)} = ${formatSom(myNet)}`
                : `Йиғилган: ${formatSom(myNet)}`}
          </div>
          {myHandover && Number(myHandover.amount) !== myNet && myHandover.confirmedAmount === null && (
            <div className="text-[12px] text-primary font-semibold mt-0.5">
              Дастлаб {formatSom(Number(myHandover.amount))} деб топширилган эди — кейинги тузатишлар билан қайта
              ҳисобланди
            </div>
          )}
          {myHandover?.note && (
            <div className="text-[12px] text-danger font-semibold mt-0.5">Сабаб: {myHandover.note}</div>
          )}
        </div>
        {!myHandover && myNet > 0 && (
          <HandoverForm
            point={!isDispatcher ? point : undefined}
            date={viewDateStr}
            computedAmount={myNet}
            action={confirmCashHandoverAction}
            adjustAction={confirmCashHandoverWithAdjustmentAction}
          />
        )}
        {myHandover && !myHandover.accountantConfirmedAt && (
          <div className="flex items-center gap-2.5">
            <span className="bg-primary-tint text-primary text-xs font-extrabold px-3 py-1.5 rounded-full whitespace-nowrap">
              Буxгалтер тасдиғини кутмоқда
            </span>
            <CancelHandoverButton action={cancelCashHandoverAction} point={!isDispatcher ? point : undefined} date={viewDateStr} />
          </div>
        )}
        {myHandover?.accountantConfirmedAt && (
          <span className="bg-success/10 text-success text-xs font-extrabold px-3 py-1.5 rounded-full">
            ✓ Буxгалтер қабул қилди
          </span>
        )}
      </Card>

      {contributionRows.length > 1 && (
        <PointContributions contributions={contributionRows} currentUserId={session.user.id} />
      )}
    </div>
  );
}
