"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Point, StaffExpenseCategory, StaffExpensePoint, TripKind } from "@prisma/client";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toStaffExpensePoint(point: Point): StaffExpensePoint {
  return point === "FARGONA" ? "FARGONA" : "QUVA";
}

async function requireDispatcher() {
  const session = await auth();
  if (!session || session.user.role !== "DISPATCHER" || !session.user.point) {
    throw new Error("Ruxsat yo'q");
  }
  return { userId: session.user.id, point: session.user.point };
}

const DEFAULT_PLAN_AMOUNT = 350_000;

export async function collectPlanPaymentAction(formData: FormData) {
  const { point } = await requireDispatcher();
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!vehicleId || !(amount > 0)) return;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.point !== point) return;

  const driver = await prisma.driver.findUnique({ where: { vehicleId } });
  if (!driver) return;

  const dayStart = startOfDay(new Date());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  const existing = await prisma.dailyPlan.findFirst({
    where: { vehicleId, planDate: { gte: dayStart, lte: dayEnd } },
  });
  const planAmount = existing?.planAmount ?? BigInt(DEFAULT_PLAN_AMOUNT);
  const newPaid = (existing ? Number(existing.paidAmount) : 0) + amount;
  const status = newPaid >= Number(planAmount) ? "FULL" : newPaid > 0 ? "PARTIAL" : "PENDING";

  if (existing) {
    await prisma.dailyPlan.update({
      where: { id: existing.id },
      data: { paidAmount: BigInt(newPaid), status, paidAt: new Date() },
    });
  } else {
    await prisma.dailyPlan.create({
      data: {
        vehicleId,
        driverId: driver.id,
        planDate: dayStart,
        planAmount,
        paidAmount: BigInt(newPaid),
        status,
        paidAt: new Date(),
      },
    });
  }

  revalidatePath("/dispatcher/point");
  revalidatePath("/dispatcher/journal");
}

export async function addTripAction(formData: FormData) {
  const { userId, point } = await requireDispatcher();

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
  const { userId, point } = await requireDispatcher();

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
  const { userId } = await requireDispatcher();
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
