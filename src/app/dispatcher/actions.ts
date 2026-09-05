"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyModuleAccess, type ModuleKey } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";
import { logEdit } from "@/lib/editLog";
import { sendSms } from "@/lib/sms";
import { formatTime } from "@/lib/format";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import { ACTIVE_POINT_COOKIE, getActivePoint } from "@/lib/activePoint";
import { computeDailyCashAmount } from "@/lib/cashHandover";
import { OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import type { Point, StaffExpenseCategory, StaffExpensePoint, TripKind, OtherIncomeCategory } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Backfilling past days (a client's paper records for other-vehicle income,
 * or trips nobody entered at the time) must land on their real date, not
 * today's — otherwise driver pay for that day would be lost, or worse,
 * silently miscounted as today's. Not bounded to the current month by
 * request — a month whose payroll was already marked PAID stays protected
 * separately (see accountant/payroll/actions.ts's own PAID check), so a
 * backdated entry here can't silently corrupt an already-paid salary.
 * Returns null (meaning "use right now") for anything missing or out of
 * bounds, same as this file's other date inputs (see addAdvanceAction). */
function parseBackdate(formData: FormData, now: Date): Date | null {
  const raw = String(formData.get("date") ?? "");
  if (!DATE_RE.test(raw)) return null;

  const picked = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(picked.getTime())) return null;
  // Compared at day granularity, not the exact instant — picked is always
  // noon UTC, so an instant-level "picked > now" would wrongly reject
  // *today's own date* whenever "now" happens to be before noon UTC (i.e.
  // most of the working day in Tashkent, UTC+5).
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (picked > endOfToday) return null;
  return picked;
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  BOSHQA: "Бошқа",
};

const POINT_LABELS: Record<Point, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
};

// UTC-pinned, not local-timezone: parseBackdate anchors a picked date at
// exactly noon UTC, so extracting the day via local getFullYear/getMonth/
// getDate (the previous implementation) only gave the right midnight when
// the running process's own local timezone happened to be UTC. On a
// Tashkent-local process (UTC+5) it silently shifted backdated handovers/
// expenses back a calendar day — confirmed against a real production
// handover whose handoverDate landed on 19:00 UTC the day before instead of
// midnight UTC of the picked day. See month.ts's monthStart for the same
// bug class (still present there — this fixes only the instance that
// produced a real, verified-wrong stored date).
function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toStaffExpensePoint(point: Point): StaffExpensePoint {
  return point === "FARGONA" ? "FARGONA" : "QUVA";
}

// A real Dispatcher acts on whichever point they're currently marked active
// on (see activePoint.ts — they physically rotate between points, so this
// isn't always their assigned home point), never on form input — so they
// can never be tricked into touching the other point's data by a crafted
// request. A back-office role granted one of the point-scoped modules has
// no point of its own, so it must say which one via the form/query string
// instead.
async function requireDispatcherOrGranted(formData: FormData, moduleKey: ModuleKey | ModuleKey[]) {
  const session = await auth();
  if (!session) throw new Error("Ruxsat yo'q");

  if (session.user.role === "DISPATCHER") {
    if (!session.user.point) throw new Error("Ruxsat yo'q");
    const point = await getActivePoint(session.user.id, session.user.point);
    return { userId: session.user.id, point };
  }

  const moduleKeys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];
  if (!(await hasAnyModuleAccess(session.user.role, moduleKeys))) {
    throw new Error("Ruxsat yo'q");
  }
  const rawPoint = String(formData.get("point") ?? "");
  const point: Point = rawPoint === "QUVA" ? "QUVA" : "FARGONA";
  return { userId: session.user.id, point };
}

/** Lets a real dispatcher say which point they're currently working at —
 * see activePoint.ts for why this is a cookie rather than updating
 * User.point directly. */
export async function setActivePointAction(formData: FormData) {
  const session = await auth();
  if (!session || session.user.role !== "DISPATCHER" || !session.user.point) return;

  const point: Point = formData.get("point") === "QUVA" ? "QUVA" : "FARGONA";
  const store = await cookies();
  store.set(ACTIVE_POINT_COOKIE, `${session.user.id}:${point}`, {
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
    sameSite: "lax",
  });

  revalidatePath("/dispatcher", "layout");
}

export type TripReceipt = {
  plate: string;
  driverName: string;
  point: Point;
  kind: TripKind;
  passengerCount: number;
  tripNumber: number | null;
  amount: number;
  time: Date;
};

/** Returns the just-created trip's receipt-relevant fields on success, or
 * null on any validation failure/early-out — the terminal print flow
 * (IncomeForm) prints a receipt only when this resolves to a real trip. */
export async function addTripAction(formData: FormData): Promise<TripReceipt | null> {
  // Guests may reach this either through the Journal (TRIP_ENTRY) or through
  // the point overview page (COLLECT_PAYMENT), which now shares this same form.
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);

  const kind = (formData.get("kind") === "ORDER" ? "ORDER" : "TRIP") as TripKind;
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  // The fleet is shared: the same vehicles shuttle between both points, so a
  // vehicle has no single "home" point — any active vehicle can be picked
  // here, and the point that matters (who collected the cash) is the acting
  // dispatcher's own point, stored on the Trip itself below.
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { driver: { include: { user: true } } },
  });
  if (!vehicle || !DISPATCHABLE_STATUSES.includes(vehicle.status) || !vehicle.driver) return null;

  const route = await prisma.route.findFirst({ where: { isActive: true } });
  if (!route) return null;

  let passengerCount = 1;
  let revenue = Number(formData.get("revenue") ?? 0);
  let tripNumber: number | null = null;

  if (kind === "TRIP") {
    passengerCount = Number(formData.get("passengerCount") ?? 0);
    if (!revenue) revenue = passengerCount * route.baseFare;
    const rawTripNumber = Number(formData.get("tripNumber") ?? "");
    tripNumber = Number.isFinite(rawTripNumber) && rawTripNumber >= 1 ? Math.floor(rawTripNumber) : null;
  }
  if (!(revenue > 0) || !Number.isFinite(passengerCount) || passengerCount < 1) return null;

  const now = new Date();
  const backdate = parseBackdate(formData, now);
  const tripDate = backdate ?? now;
  await prisma.trip.create({
    data: {
      vehicleId,
      driverId: vehicle.driver.id,
      routeId: route.id,
      point,
      tripDate,
      departureTime: tripDate,
      passengerCount,
      tripNumber,
      revenue: BigInt(Math.round(revenue)),
      kind,
      note,
      enteredBy: userId,
    },
  });

  // A backdated entry is paperwork catch-up, not a live event — the driver
  // doesn't need an SMS about it, and the terminal shouldn't print a
  // passenger receipt for a trip that already happened days ago either.
  if (backdate) {
    revalidatePath("/dispatcher/journal");
    revalidatePath("/dispatcher/point");
    return null;
  }

  const kindLabel = kind === "ORDER" ? "Алоҳида заказ" : tripNumber ? `${tripNumber}-рейс` : "Рейс";
  // Awaited (not fired-and-forgotten) — on a serverless runtime the
  // function can be frozen the instant this action returns, which would
  // silently drop an in-flight SMS request.
  await sendSms(
    vehicle.driver.user.phone,
    `Ҳурматли ${vehicle.driver.user.fullName}, ${kindLabel} қайд этилди. Пункт: ${POINT_LABELS[point]}. Сумма: ${Math.round(revenue).toLocaleString("uz-UZ")} сўм. Вақт: ${formatTime(now)}.`
  );

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");

  return {
    plate: vehicle.plate,
    driverName: vehicle.driver.user.fullName,
    point,
    kind,
    passengerCount,
    tripNumber,
    amount: Math.round(revenue),
    time: now,
  };
}

/** Cash from a vehicle outside the company's own fleet — paying for tax
 * paperwork, fuel, a parking spot, or similar — collected by the dispatcher
 * the same way trip revenue is, so it counts toward the same cash pool
 * (see createTodaysHandover below). No vehicleId to attach to (that vehicle
 * doesn't exist in this system), so note is the only record of what/who it
 * was for. */
export async function addOtherIncomeAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);

  const rawCategory = String(formData.get("category") ?? "");
  const category: OtherIncomeCategory = OTHER_INCOME_CATEGORIES.includes(rawCategory as OtherIncomeCategory)
    ? (rawCategory as OtherIncomeCategory)
    : "BOSHQA";
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  const plateNumber = String(formData.get("plateNumber") ?? "").trim() || null;
  if (!(amount > 0)) return;

  const now = new Date();
  const incomeDate = parseBackdate(formData, now) ?? now;
  await prisma.otherIncome.create({
    data: {
      point,
      category,
      amount: BigInt(Math.round(amount)),
      note,
      plateNumber,
      incomeDate,
      enteredBy: userId,
    },
  });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}

// The dispatcher hands over a day's cash-in-hand to the accountant once a
// day, in person — this just records that confirmation. amount is trip
// revenue plus other-vehicle income (tax/fuel/parking-lot payments from
// vehicles outside the company's own fleet — see OtherIncome) minus that
// day's point-level expenses/lunches (see journal/page.tsx's identical
// kirim/chiqim/qoldiq math) — real cash actually counted and handed over,
// not the raw collected total, since that's already spent down by whatever
// was paid out of it that day. targetDate is normally today (the common
// case — see the two exported actions below), but the dispatcher can also
// be viewing a past day (see point/page.tsx's date picker) and submit a
// handover they missed at the time; the balance formula stays correct
// either way since it keys off accountantConfirmedAt (always "right now"
// when the accountant acts), not this date. A snapshot at confirm time, not
// a live figure that could drift if a trip gets entered afterward.
// Idempotent: a second confirm the same day is a silent no-op rather than
// duplicating.
//
// overrideAmount/note cover the case where the computed figure doesn't match
// what was actually counted (a missed expense, a rounding difference, ...) —
// the dispatcher can hand over a different amount, but only with a reason on
// record, since that's real cash silently diverging from the log.
async function createHandoverForDate(
  userId: string,
  point: Point,
  targetDate: Date,
  overrideAmount?: bigint,
  note?: string
): Promise<{ error: string }> {
  const today = startOfDay(targetDate);
  const existing = await prisma.cashHandover.findUnique({
    where: { point_handoverDate_dispatcherConfirmedBy: { point, handoverDate: today, dispatcherConfirmedBy: userId } },
  });
  if (existing) return { error: "" };

  // What THIS dispatcher personally has left to hand over — see
  // computeDailyCashAmount's own comment. A colleague working the same
  // point/day submits their own separate handover (dispatchers rotate
  // shifts), each scoped to their own enteredBy trail. Note this is only a
  // snapshot at submission time: computeCashBalance/computeBalanceLedger
  // (ownerPayout.ts) recompute this live on every read rather than
  // trusting the frozen CashHandover.amount column below, specifically so
  // a trip/expense correction made after today's handover already exists
  // still reaches the owner's balance instead of silently going stale.
  const computed = await computeDailyCashAmount(point, today, userId);
  const amount = overrideAmount ?? computed;

  await prisma.cashHandover.create({
    data: {
      point,
      handoverDate: today,
      amount,
      note: note || null,
      dispatcherConfirmedBy: userId,
      dispatcherConfirmedAt: new Date(),
    },
  });

  revalidatePath("/dispatcher/point");
  revalidatePath("/accountant/report");
  return { error: "" };
}

export async function confirmCashHandoverAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);
  const now = new Date();
  await createHandoverForDate(userId, point, parseBackdate(formData, now) ?? now);
}

export type ConfirmHandoverState = { error: string };

/** Same as confirmCashHandoverAction, but for when the computed amount
 * doesn't match what was actually counted — the dispatcher enters the real
 * amount by hand, and must say why it differs. */
export async function confirmCashHandoverWithAdjustmentAction(
  _prevState: ConfirmHandoverState,
  formData: FormData
): Promise<ConfirmHandoverState> {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);

  const rawAmount = Number(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isFinite(rawAmount) || rawAmount < 0) return { error: "Суммани тўғри киритинг" };
  if (!note) return { error: "Сабабини киритинг" };

  const now = new Date();
  return createHandoverForDate(userId, point, parseBackdate(formData, now) ?? now, BigInt(Math.round(rawAmount)), note);
}

/** Undoes an accidental "Топшириш" click — only while the accountant hasn't
 * confirmed receipt yet, since after that the cash has genuinely already
 * changed hands and been counted on their end; undoing at that point would
 * desync from reality rather than fix a mistake. */
export async function cancelCashHandoverAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);

  const now = new Date();
  const targetDate = startOfDay(parseBackdate(formData, now) ?? now);
  // Scoped to this dispatcher's own submission — a colleague's separate
  // handover for the same point/day is untouched by this.
  const handover = await prisma.cashHandover.findUnique({
    where: { point_handoverDate_dispatcherConfirmedBy: { point, handoverDate: targetDate, dispatcherConfirmedBy: userId } },
  });
  if (!handover || handover.accountantConfirmedAt) return;

  await logDeletion(
    "CashHandover",
    handover.id,
    `${POINT_LABELS[point]} · ${handover.amount.toString()} сўм${handover.note ? ` · ${handover.note}` : ""}`,
    userId
  );
  await prisma.cashHandover.delete({ where: { id: handover.id } });

  revalidatePath("/dispatcher/point");
  revalidatePath("/accountant/report");
}

export type UpdateTripState = { error: string };

export async function updateTripAction(
  _prevState: UpdateTripState,
  formData: FormData
): Promise<UpdateTripState> {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);
  const id = String(formData.get("id") ?? "");

  const trip = await prisma.trip.findUnique({ where: { id }, include: { vehicle: true, driver: { include: { user: true } } } });
  if (!trip || trip.point !== point) return { error: "Рейс топилмади" };

  const driverId = String(formData.get("driverId") ?? "").trim();
  const kind = (formData.get("kind") === "ORDER" ? "ORDER" : "TRIP") as TripKind;
  const note = String(formData.get("note") ?? "").trim() || null;
  const revenue = Number(formData.get("revenue") ?? 0);
  let passengerCount = 1;
  let tripNumber: number | null = null;
  if (kind === "TRIP") {
    passengerCount = Number(formData.get("passengerCount") ?? 0);
    const rawTripNumber = Number(formData.get("tripNumber") ?? "");
    tripNumber = Number.isFinite(rawTripNumber) && rawTripNumber >= 1 ? Math.floor(rawTripNumber) : null;
  }

  if (!driverId) return { error: "Ҳайдовчини танланг" };
  if (!(revenue > 0)) return { error: "Суммани тўғри киритинг" };
  if (kind === "TRIP" && (!Number.isFinite(passengerCount) || passengerCount < 1)) {
    return { error: "Йўловчилар сонини тўғри киритинг" };
  }

  const newRevenue = BigInt(Math.round(revenue));
  if (newRevenue !== trip.revenue) {
    await logEdit(
      "Trip",
      trip.id,
      `${trip.vehicle.plate} · ${trip.driver.user.fullName} · ${trip.revenue.toString()} → ${newRevenue.toString()} сўм`,
      userId
    );
  }

  await prisma.trip.update({
    where: { id },
    data: { driverId, kind, passengerCount, tripNumber, revenue: newRevenue, note },
  });

  const backTo = String(formData.get("backTo") ?? "") === "point" ? "/dispatcher/point" : "/dispatcher/journal";
  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
  redirect(backTo);
}

export async function deleteTripAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);
  const id = String(formData.get("id") ?? "");

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { vehicle: true, driver: { include: { user: true } } },
  });
  if (!trip || trip.point !== point) return;

  const kindLabel = trip.kind === "ORDER" ? "Заказ" : "Рейс";
  await logDeletion(
    "Trip",
    trip.id,
    `${kindLabel} · ${trip.vehicle.plate} · ${trip.driver.user.fullName} · ${trip.revenue.toString()} сўм`,
    userId
  );
  await prisma.trip.delete({ where: { id } });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}

export async function addStaffExpenseAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");

  const category = formData.get("category") as StaffExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!(amount > 0) || !category) return;

  const now = new Date();
  const expenseDate = parseBackdate(formData, now) ?? now;
  await prisma.staffExpense.create({
    data: {
      userId,
      point: toStaffExpensePoint(point),
      category,
      amount: BigInt(Math.round(amount)),
      note,
      expenseDate,
      enteredBy: userId,
    },
  });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}

export type UpdateStaffExpenseState = { error: string };

export async function updateStaffExpenseAction(
  _prevState: UpdateStaffExpenseState,
  formData: FormData
): Promise<UpdateStaffExpenseState> {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const id = String(formData.get("id") ?? "");

  const expense = await prisma.staffExpense.findUnique({ where: { id }, include: { user: true } });
  if (!expense || expense.point !== toStaffExpensePoint(point)) return { error: "Ёзув топилмади" };

  const category = formData.get("category") as StaffExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!category) return { error: "Тоифани танланг" };
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  const newAmount = BigInt(Math.round(amount));
  if (newAmount !== expense.amount) {
    await logEdit(
      "StaffExpense",
      expense.id,
      `${EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} · ${expense.user.fullName} · ${expense.amount.toString()} → ${newAmount.toString()} сўм`,
      userId
    );
  }

  await prisma.staffExpense.update({
    where: { id },
    data: { category, amount: newAmount, note },
  });

  const backTo = String(formData.get("backTo") ?? "") === "point" ? "/dispatcher/point" : "/dispatcher/journal";
  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
  redirect(backTo);
}

export async function deleteStaffExpenseAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const id = String(formData.get("id") ?? "");

  const expense = await prisma.staffExpense.findUnique({ where: { id } });
  if (!expense || expense.point !== toStaffExpensePoint(point)) return;

  await logDeletion(
    "StaffExpense",
    expense.id,
    `${EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} · ${expense.amount.toString()} сўм${expense.note ? ` · ${expense.note}` : ""}`,
    userId
  );
  await prisma.staffExpense.delete({ where: { id } });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}

const DEFAULT_LUNCH_AMOUNT = 12_000;

export type AddLunchState = { error: string };

/** Lunch is uniquely keyed per (person, calendar day) — GLOBALLY, not per
 * point — since a person only eats lunch once a day, regardless of which
 * point's dispatcher happens to log it (the fleet is shared, so the same
 * driver plausibly shows up in both points' own recipient lists the same
 * day). Before this check, a second dispatcher logging the same person's
 * lunch at the OTHER point silently overwrote the first one's point (the
 * upsert's `update` branch always applied its own `point`) — the first
 * dispatcher's entry then vanished from their own journal (filtered by
 * their point) with no explanation, confirmed against real production
 * data: a real driver's lunch really did flip from FARGONA to QUVA this
 * way. Rejecting the conflicting submission with a clear reason — instead
 * of silently reassigning it — trades a rare "already logged elsewhere"
 * error for never again losing an entry without a trace. */
export async function addLunchAction(formData: FormData): Promise<AddLunchState> {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  // A dispatcher can log lunch for any driver or dispatcher, not just
  // themselves — the "forUserId" field carries who it's for, and falls back
  // to self when omitted so the simple self-lunch flow keeps working.
  const forUserId = String(formData.get("forUserId") ?? "").trim() || userId;
  const raw = Number(formData.get("amount"));
  const amount = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LUNCH_AMOUNT;
  const now = new Date();
  const lunchDate = startOfDay(parseBackdate(formData, now) ?? now);

  const existing = await prisma.lunch.findUnique({
    where: { userId_lunchDate: { userId: forUserId, lunchDate } },
    include: { user: true },
  });
  if (existing && existing.point !== point) {
    return {
      error: `${existing.user.fullName} учун бугун аллақачон ${POINT_LABELS[existing.point]} пунктида тушлик киритилган`,
    };
  }

  await prisma.lunch.upsert({
    where: { userId_lunchDate: { userId: forUserId, lunchDate } },
    create: { userId: forUserId, point, amount: BigInt(Math.round(amount)), lunchDate, enteredBy: userId },
    update: { amount: BigInt(Math.round(amount)), point },
  });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
  return { error: "" };
}

export type UpdateLunchState = { error: string };

export async function updateLunchAction(
  _prevState: UpdateLunchState,
  formData: FormData
): Promise<UpdateLunchState> {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const id = String(formData.get("id") ?? "");

  const lunch = await prisma.lunch.findUnique({ where: { id }, include: { user: true } });
  if (!lunch || lunch.point !== point) return { error: "Ёзув топилмади" };

  const amount = Number(formData.get("amount") ?? 0);
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  const newAmount = BigInt(Math.round(amount));
  if (newAmount !== lunch.amount) {
    await logEdit(
      "Lunch",
      lunch.id,
      `Тушлик · ${lunch.user.fullName} · ${lunch.amount.toString()} → ${newAmount.toString()} сўм`,
      userId
    );
  }

  await prisma.lunch.update({ where: { id }, data: { amount: newAmount } });

  const backTo = String(formData.get("backTo") ?? "") === "point" ? "/dispatcher/point" : "/dispatcher/journal";
  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
  redirect(backTo);
}

export async function deleteLunchAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const id = String(formData.get("id") ?? "");

  const lunch = await prisma.lunch.findUnique({ where: { id }, include: { user: true } });
  if (!lunch || lunch.point !== point) return;

  await logDeletion(
    "Lunch",
    lunch.id,
    `Тушлик · ${lunch.user.fullName} · ${lunch.amount.toString()} сўм`,
    userId
  );
  await prisma.lunch.delete({ where: { id } });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}

export async function deleteOtherIncomeAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);
  const id = String(formData.get("id") ?? "");

  const income = await prisma.otherIncome.findUnique({ where: { id } });
  if (!income || income.point !== point) return;

  await logDeletion(
    "OtherIncome",
    income.id,
    `${OTHER_INCOME_CATEGORY_LABELS[income.category]} · ${income.amount.toString()} сўм${income.plateNumber ? ` · ${income.plateNumber}` : ""}${income.note ? ` · ${income.note}` : ""}`,
    userId
  );
  await prisma.otherIncome.delete({ where: { id } });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}
