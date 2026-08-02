"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyModuleAccess, type ModuleKey } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";
import type { Point, StaffExpenseCategory, StaffExpensePoint, TripKind } from "@prisma/client";

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  BOSHQA: "Бошқа",
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
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { driver: true } });
  if (!vehicle || vehicle.status !== "ACTIVE" || !vehicle.driver) return;

  const route = await prisma.route.findFirst({ where: { isActive: true } });
  if (!route) return;

  let passengerCount = 1;
  let revenue = Number(formData.get("revenue") ?? 0);

  if (kind === "TRIP") {
    passengerCount = Number(formData.get("passengerCount") ?? 0);
    if (!revenue) revenue = passengerCount * route.baseFare;
  }
  if (!(revenue > 0) || !Number.isFinite(passengerCount) || passengerCount < 1) return;

  await prisma.trip.create({
    data: {
      vehicleId,
      driverId: vehicle.driver.id,
      routeId: route.id,
      point,
      tripDate: new Date(),
      departureTime: new Date(),
      passengerCount,
      revenue: BigInt(Math.round(revenue)),
      kind,
      note,
      enteredBy: userId,
    },
  });

  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
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
  if (kind === "TRIP") {
    passengerCount = Number(formData.get("passengerCount") ?? 0);
  }

  if (!driverId) return { error: "Ҳайдовчини танланг" };
  if (!(revenue > 0)) return { error: "Суммани тўғри киритинг" };
  if (kind === "TRIP" && (!Number.isFinite(passengerCount) || passengerCount < 1)) {
    return { error: "Йўловчилар сонини тўғри киритинг" };
  }

  await prisma.trip.update({
    where: { id },
    data: { driverId, kind, passengerCount, revenue: BigInt(Math.round(revenue)), note },
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
  const { userId } = await requireDispatcherOrGranted(formData, "INCOME_EXPENSE_LOG");
  const raw = Number(formData.get("amount"));
  const amount = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LUNCH_AMOUNT;
  const lunchDate = startOfDay(new Date());

  await prisma.lunch.upsert({
    where: { userId_lunchDate: { userId, lunchDate } },
    create: { userId, amount: BigInt(Math.round(amount)), lunchDate, enteredBy: userId },
    update: { amount: BigInt(Math.round(amount)) },
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

  const lunch = await prisma.lunch.findUnique({ where: { id }, include: { user: true } });
  if (!lunch || lunch.user.point !== point) return { error: "Ёзув топилмади" };

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
  if (!lunch || lunch.user.point !== point) return;

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
