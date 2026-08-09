"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyModuleAccess, type ModuleKey } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";
import { sendSms } from "@/lib/sms";
import { formatTime } from "@/lib/format";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import type { Point, StaffExpenseCategory, StaffExpensePoint, TripKind } from "@prisma/client";

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  BOSHQA: "Бошқа",
};

const POINT_LABELS: Record<Point, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toStaffExpensePoint(point: Point): StaffExpensePoint {
  return point === "FARGONA" ? "FARGONA" : "QUVA";
}

// A real Dispatcher always acts on their own point (form input is ignored,
// so they can never be tricked into touching the other point's data). A
// back-office role granted one of the point-scoped modules has no point of
// its own, so it must say which one via the form/query string instead.
async function requireDispatcherOrGranted(formData: FormData, moduleKey: ModuleKey | ModuleKey[]) {
  const session = await auth();
  if (!session) throw new Error("Ruxsat yo'q");

  if (session.user.role === "DISPATCHER") {
    if (!session.user.point) throw new Error("Ruxsat yo'q");
    return { userId: session.user.id, point: session.user.point };
  }

  const moduleKeys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];
  if (!(await hasAnyModuleAccess(session.user.role, moduleKeys))) {
    throw new Error("Ruxsat yo'q");
  }
  const rawPoint = String(formData.get("point") ?? "");
  const point: Point = rawPoint === "QUVA" ? "QUVA" : "FARGONA";
  return { userId: session.user.id, point };
}

export async function addTripAction(formData: FormData) {
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
  if (!vehicle || !DISPATCHABLE_STATUSES.includes(vehicle.status) || !vehicle.driver) return;

  const route = await prisma.route.findFirst({ where: { isActive: true } });
  if (!route) return;

  let passengerCount = 1;
  let revenue = Number(formData.get("revenue") ?? 0);
  let tripNumber: number | null = null;

  if (kind === "TRIP") {
    passengerCount = Number(formData.get("passengerCount") ?? 0);
    if (!revenue) revenue = passengerCount * route.baseFare;
    const rawTripNumber = Number(formData.get("tripNumber") ?? "");
    tripNumber = Number.isFinite(rawTripNumber) && rawTripNumber >= 1 ? Math.floor(rawTripNumber) : null;
  }
  if (!(revenue > 0) || !Number.isFinite(passengerCount) || passengerCount < 1) return;

  const now = new Date();
  await prisma.trip.create({
    data: {
      vehicleId,
      driverId: vehicle.driver.id,
      routeId: route.id,
      point,
      tripDate: now,
      departureTime: now,
      passengerCount,
      tripNumber,
      revenue: BigInt(Math.round(revenue)),
      kind,
      note,
      enteredBy: userId,
    },
  });

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
}

// The dispatcher hands over today's cash-in-hand to the accountant once a
// day, in person — this just records that confirmation. amount is a
// snapshot of today's collected total at the moment of confirming (real
// cash actually counted and handed over), not a live figure that could
// drift if a trip gets entered afterward. Idempotent: a second confirm the
// same day is a silent no-op rather than creating a duplicate handover.
export async function confirmCashHandoverAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);

  const today = startOfDay(new Date());
  const existing = await prisma.cashHandover.findUnique({
    where: { point_handoverDate: { point, handoverDate: today } },
  });
  if (existing) return;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const trips = await prisma.trip.findMany({
    where: { tripDate: { gte: today, lt: tomorrow }, point },
    select: { revenue: true },
  });
  const amount = trips.reduce((s, t) => s + t.revenue, BigInt(0));

  await prisma.cashHandover.create({
    data: { point, handoverDate: today, amount, dispatcherConfirmedBy: userId, dispatcherConfirmedAt: new Date() },
  });

  revalidatePath("/dispatcher/point");
  revalidatePath("/accountant/report");
}

export type UpdateTripState = { error: string };

export async function updateTripAction(
  _prevState: UpdateTripState,
  formData: FormData
): Promise<UpdateTripState> {
  const { point } = await requireDispatcherOrGranted(formData, ["TRIP_ENTRY", "COLLECT_PAYMENT"]);
  const id = String(formData.get("id") ?? "");

  const trip = await prisma.trip.findUnique({ where: { id } });
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

  await prisma.trip.update({
    where: { id },
    data: { driverId, kind, passengerCount, tripNumber, revenue: BigInt(Math.round(revenue)), note },
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

  await prisma.staffExpense.create({
    data: {
      userId,
      point: toStaffExpensePoint(point),
      category,
      amount: BigInt(Math.round(amount)),
      note,
      expenseDate: new Date(),
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
  const { point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const id = String(formData.get("id") ?? "");

  const expense = await prisma.staffExpense.findUnique({ where: { id } });
  if (!expense || expense.point !== toStaffExpensePoint(point)) return { error: "Ёзув топилмади" };

  const category = formData.get("category") as StaffExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!category) return { error: "Тоифани танланг" };
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  await prisma.staffExpense.update({
    where: { id },
    data: { category, amount: BigInt(Math.round(amount)), note },
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

export async function addLunchAction(formData: FormData) {
  const { userId, point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  // A dispatcher can log lunch for any driver or dispatcher, not just
  // themselves — the "forUserId" field carries who it's for, and falls back
  // to self when omitted so the simple self-lunch flow keeps working.
  const forUserId = String(formData.get("forUserId") ?? "").trim() || userId;
  const raw = Number(formData.get("amount"));
  const amount = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LUNCH_AMOUNT;
  const lunchDate = startOfDay(new Date());

  await prisma.lunch.upsert({
    where: { userId_lunchDate: { userId: forUserId, lunchDate } },
    create: { userId: forUserId, point, amount: BigInt(Math.round(amount)), lunchDate, enteredBy: userId },
    update: { amount: BigInt(Math.round(amount)), point },
  });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
}

export type UpdateLunchState = { error: string };

export async function updateLunchAction(
  _prevState: UpdateLunchState,
  formData: FormData
): Promise<UpdateLunchState> {
  const { point } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const id = String(formData.get("id") ?? "");

  const lunch = await prisma.lunch.findUnique({ where: { id } });
  if (!lunch || lunch.point !== point) return { error: "Ёзув топилмади" };

  const amount = Number(formData.get("amount") ?? 0);
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  await prisma.lunch.update({ where: { id }, data: { amount: BigInt(Math.round(amount)) } });

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
