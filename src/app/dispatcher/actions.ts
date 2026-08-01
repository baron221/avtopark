"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyModuleAccess, type ModuleKey } from "@/lib/access";
import type { Point, StaffExpenseCategory, StaffExpensePoint, TripKind } from "@prisma/client";

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

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { driver: true } });
  if (!vehicle || vehicle.point !== point || !vehicle.driver) return;

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
