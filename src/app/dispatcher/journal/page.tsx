import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { formatSom, formatTime } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { getActivePoint } from "@/lib/activePoint";
import { monthStart } from "@/lib/month";
import { ExpenseForm } from "./ExpenseForm";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { deleteTripAction, deleteStaffExpenseAction, deleteLunchAction, deleteOtherIncomeAction } from "../actions";
import { addExternalVehicleAction, deleteExternalVehicleAction } from "@/app/actions";
import { OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import { getExternalVehicles } from "@/lib/externalVehicle";
import { ExternalVehicleManager } from "@/components/ExternalVehicleManager";
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

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  BOSHQA: "Бошқа",
};

export default async function DispatcherJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ point?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  const guestAllowed =
    !isDispatcher &&
    ((await hasModuleAccess(session.user.role, "TRIP_ENTRY")) ||
      (await hasModuleAccess(session.user.role, "INCOME_EXPENSE_LOG")));
  if (!isDispatcher && !guestAllowed) redirect("/coming-soon");

  const { point: pointParam, date: dateParam } = await searchParams;
  const point: Point = isDispatcher
    ? await getActivePoint(session.user.id, session.user.point!)
    : pointParam === "QUVA"
      ? "QUVA"
      : "FARGONA";
  const staffExpensePoint = point === "FARGONA" ? "FARGONA" : "QUVA";
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStartDate = monthStart(now);
  const monthStartStr = monthStartDate.toISOString().slice(0, 10);

  // Same "which day am I looking at" picker as point/page.tsx — see its
  // comment for why.
  let viewDate = now;
  if (dateParam && DATE_RE.test(dateParam)) {
    const parsed = new Date(`${dateParam}T12:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed >= monthStartDate && parsed <= endOfDay(now)) {
      viewDate = parsed;
    }
  }
  const from = startOfDay(viewDate);
  const to = endOfDay(viewDate);
  const viewDateStr = from.toISOString().slice(0, 10);
  const isToday = from.getTime() === startOfDay(now).getTime();

  const [trips, otherIncomes, expenses, lunches, drivers, dispatchers, externalVehicles] = await Promise.all([
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to }, point },
      include: { vehicle: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.otherIncome.findMany({
      where: { point, incomeDate: { gte: from, lte: to } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffExpense.findMany({
      where: { point: staffExpensePoint, expenseDate: { gte: from, lte: to } },
    }),
    prisma.lunch.findMany({
      where: { lunchDate: { gte: from, lte: to }, point },
      include: { user: true },
    }),
    prisma.driver.findMany({ include: { user: true, vehicle: true }, orderBy: { user: { fullName: "asc" } } }),
    prisma.user.findMany({
      where: { role: "DISPATCHER", isActive: true },
      orderBy: { fullName: "asc" },
    }),
    getExternalVehicles(),
  ]);

  const lunchPeople = [
    ...drivers.map((d) => ({
      userId: d.userId,
      label: d.vehicle ? `${d.vehicle.plate} · ${d.user.fullName}` : d.user.fullName,
    })),
    ...dispatchers.map((u) => ({ userId: u.id, label: u.fullName })),
  ];

  const kirim =
    trips.reduce((s, t) => s + Number(t.revenue), 0) + otherIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const chiqim = expenses.reduce((s, e) => s + Number(e.amount), 0) + lunches.reduce((s, l) => s + Number(l.amount), 0);
  const qoldiq = kirim - chiqim;

  const canTripEntry = isDispatcher || (await hasModuleAccess(session.user.role, "TRIP_ENTRY"));
  const canIncomeExpense = isDispatcher || (await hasModuleAccess(session.user.role, "INCOME_EXPENSE_LOG"));
  const deletePoint = isDispatcher ? undefined : point;

  type LogEntry = {
    id: string;
    time: Date;
    kind: string;
    kindBg: string;
    kindColor: string;
    detail: string;
    amount: number;
    deleteAction?: (formData: FormData) => Promise<void>;
    editHref?: string;
  };
  const log: LogEntry[] = [
    ...trips.map((t) => ({
      id: t.id,
      time: t.createdAt,
      kind: t.kind === "ORDER" ? "Заказ" : "Рейс",
      kindBg: t.kind === "ORDER" ? "#E4F5EC" : "#EEF0F8",
      kindColor: t.kind === "ORDER" ? "#1B9E6B" : "#4F46E5",
      detail: t.note ?? `${t.vehicle.plate}${t.tripNumber ? ` · ${t.tripNumber}-рейс` : ""} · Фарғона → Қува`,
      amount: Number(t.revenue),
      deleteAction: canTripEntry ? deleteTripAction : undefined,
      editHref: canTripEntry
        ? `/dispatcher/trips/${t.id}/edit?from=journal${isDispatcher ? "" : `&point=${point}`}`
        : undefined,
    })),
    ...otherIncomes.map((i) => ({
      id: i.id,
      time: i.createdAt,
      kind: OTHER_INCOME_CATEGORY_LABELS[i.category],
      kindBg: "#E4F5EC",
      kindColor: "#1B9E6B",
      detail: [i.plateNumber, i.note].filter(Boolean).join(" · ") || OTHER_INCOME_CATEGORY_LABELS[i.category],
      amount: Number(i.amount),
      deleteAction: canTripEntry ? deleteOtherIncomeAction : undefined,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      time: e.expenseDate,
      kind: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      kindBg: "#FDECEA",
      kindColor: "#D9534F",
      detail: e.note ?? EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      amount: -Number(e.amount),
      deleteAction: canIncomeExpense ? deleteStaffExpenseAction : undefined,
      editHref: canIncomeExpense
        ? `/dispatcher/expenses/${e.id}/edit?from=journal${isDispatcher ? "" : `&point=${point}`}`
        : undefined,
    })),
    ...lunches.map((l) => ({
      id: l.id,
      // Not l.lunchDate — that's always UTC midnight (the per-day unique
      // key, see the model's own schema comment), so every lunch would
      // otherwise show the same nonsense 05:00 Tashkent "time".
      time: l.createdAt,
      kind: "Обед",
      kindBg: "#FFF3E0",
      kindColor: "#B26A00",
      detail: `Тушлик · ${l.user.fullName}`,
      amount: -Number(l.amount),
      deleteAction: canIncomeExpense ? deleteLunchAction : undefined,
      editHref: canIncomeExpense
        ? `/dispatcher/lunches/${l.id}/edit?from=journal${isDispatcher ? "" : `&point=${point}`}`
        : undefined,
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Кирим-чиқим · {viewDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
            {!isToday && <span className="text-primary"> (ўтган кун)</span>}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">{session.user.name}</div>
        </div>
        <div className="flex gap-4 text-sm font-extrabold flex-wrap items-center">
          <span className="text-success">Кирим: +{formatSom(kirim)}</span>
          <span className="text-danger">Чиқим: −{formatSom(chiqim)}</span>
          <span className="text-heading">Қолдиқ: {formatSom(qoldiq)}</span>
          <DatePicker
            basePath="/dispatcher/journal"
            value={viewDateStr}
            min={monthStartStr}
            extraParams={!isDispatcher ? { point } : undefined}
          />
          {!isDispatcher && (
            <div className="flex gap-2">
              <Link
                href={`/dispatcher/journal?point=FARGONA&date=${viewDateStr}`}
                className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  point === "FARGONA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
                }`}
              >
                Фарғона
              </Link>
              <Link
                href={`/dispatcher/journal?point=QUVA&date=${viewDateStr}`}
                className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  point === "QUVA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
                }`}
              >
                Қува
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          {isDispatcher && (
            <ExpenseForm
              point={undefined}
              people={lunchPeople}
              todayStr={todayStr}
              defaultDateStr={viewDateStr}
            />
          )}
          {canIncomeExpense && (
            <ExternalVehicleManager
              vehicles={externalVehicles}
              addAction={addExternalVehicleAction}
              deleteAction={deleteExternalVehicleAction}
            />
          )}
        </div>

        <Card className="overflow-hidden hidden lg:block">
          <div className="px-5 py-3.5 font-heading font-bold text-[15px] text-heading">{isToday ? "Бугунги журнал" : "Журнал"}</div>
          {log.map((l, i) => (
            <div
              key={l.id}
              className="grid grid-cols-[28px_52px_100px_1fr_auto_48px] gap-2.5 px-5 py-2.5 border-t border-row-divider items-center text-[13px]"
            >
              <div className="text-muted-2 font-bold">{i + 1}</div>
              <div className="text-muted-2 font-bold">{formatTime(l.time)}</div>
              <div>
                <span
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                  style={{ background: l.kindBg, color: l.kindColor }}
                >
                  {l.kind}
                </span>
              </div>
              <div className="text-body font-semibold min-w-0 break-words">{l.detail}</div>
              <div className={`font-extrabold ${l.amount >= 0 ? "text-success" : "text-danger"}`}>
                {l.amount >= 0 ? "+" : "−"}
                {formatSom(Math.abs(l.amount))}
              </div>
              <div className="flex items-center gap-1.5">
                {l.editHref && (
                  <Link href={l.editHref} title="Таҳрирлаш" className="text-muted-2 hover:text-primary text-base leading-none px-1">
                    ✎
                  </Link>
                )}
                {l.deleteAction && <DeleteEntryButton action={l.deleteAction} id={l.id} point={deletePoint} />}
              </div>
            </div>
          ))}
          {log.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">{isToday ? "Бугун" : "Бу кунда"} ҳали ёзув йўқ</p>}
        </Card>

        <Card className="overflow-hidden lg:hidden">
          <div className="px-5 py-3.5 font-heading font-bold text-[15px] text-heading">{isToday ? "Бугунги журнал" : "Журнал"}</div>
          {log.map((l, i) => (
            <div key={l.id} className="flex flex-col gap-1.5 px-5 py-3 border-t border-row-divider text-[13px]">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-2 font-bold">{i + 1}.</span>
                  <span className="text-muted-2 font-bold">{formatTime(l.time)}</span>
                  <span
                    className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                    style={{ background: l.kindBg, color: l.kindColor }}
                  >
                    {l.kind}
                  </span>
                </div>
                <div className={`font-extrabold ${l.amount >= 0 ? "text-success" : "text-danger"}`}>
                  {l.amount >= 0 ? "+" : "−"}
                  {formatSom(Math.abs(l.amount))}
                </div>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="text-body font-semibold min-w-0 break-words">{l.detail}</div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {l.editHref && (
                    <Link href={l.editHref} title="Таҳрирлаш" className="text-muted-2 hover:text-primary text-base leading-none px-1">
                      ✎
                    </Link>
                  )}
                  {l.deleteAction && <DeleteEntryButton action={l.deleteAction} id={l.id} point={deletePoint} />}
                </div>
              </div>
            </div>
          ))}
          {log.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">{isToday ? "Бугун" : "Бу кунда"} ҳали ёзув йўқ</p>}
        </Card>
      </div>
    </div>
  );
}
