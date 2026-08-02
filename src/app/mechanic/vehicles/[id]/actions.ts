"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { currentMonthDate, syncDriverVehicleAssignment } from "@/lib/driverAssignment";
import { hasModuleAccess } from "@/lib/access";
import type { ExpenseCategory, Point, SalaryType, VehicleStatus, VehicleType } from "@prisma/client";

async function requireMechanic() {
  const session = await auth();
  if (!session || (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES")))) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
}

export type UpdateVehicleState = { error: string };

export async function updateVehicleAction(
  _prevState: UpdateVehicleState,
  formData: FormData
): Promise<UpdateVehicleState> {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const plate = String(formData.get("plate") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const type = formData.get("type") as VehicleType;
  const seats = Math.round(Number(formData.get("seats") ?? 0));
  const purchasePrice = Math.round(Number(formData.get("purchasePrice") ?? 0));
  const point = (formData.get("point") as Point | null) || null;

  if (!vehicleId || !plate || !model || !(seats > 0) || !(purchasePrice > 0)) {
    return { error: "Барча майдонларни тўғри тўлдиринг" };
  }

  const existing = await prisma.vehicle.findUnique({ where: { plate } });
  if (existing && existing.id !== vehicleId) {
    return { error: "Бу давлат рақами билан бошқа машина аллақачон мавжуд" };
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { plate, model, type, seats, point, purchasePrice: BigInt(purchasePrice) },
  });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
  redirect(`/mechanic/vehicles/${vehicleId}`);
}

export async function addVehicleExpenseAction(formData: FormData) {
  const userId = await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const category = formData.get("category") as ExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!vehicleId || !category || !(amount > 0)) return;

  await prisma.expense.create({
    data: {
      vehicleId,
      category,
      amount: BigInt(Math.round(amount)),
      expenseDate: new Date(),
      note,
      enteredBy: userId,
    },
  });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
}

export async function addOilChangeAction(formData: FormData) {
  const userId = await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const odometerKm = Math.round(Number(formData.get("odometerKm") ?? 0));
  const intervalKm = Math.round(Number(formData.get("intervalKm") ?? 0));
  const intervalMonths = Math.round(Number(formData.get("intervalMonths") ?? 0));
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!vehicleId || !(odometerKm > 0) || !(intervalKm > 0) || !(intervalMonths > 0) || !(amount > 0)) return;

  const changedAt = new Date();

  await prisma.$transaction([
    prisma.oilChange.create({
      data: { vehicleId, changedAt, odometerKm, intervalKm, intervalMonths, amount: BigInt(Math.round(amount)), note, enteredBy: userId },
    }),
    prisma.expense.create({
      data: {
        vehicleId,
        category: "REPAIR",
        amount: BigInt(Math.round(amount)),
        expenseDate: changedAt,
        note: note ? `Мой алмаштириш · ${note}` : "Мой алмаштириш",
        enteredBy: userId,
      },
    }),
    prisma.vehicle.update({ where: { id: vehicleId }, data: { odometerKm } }),
  ]);

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
}

export async function updateVehicleStatusAction(formData: FormData) {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const status = formData.get("status") as VehicleStatus;
  if (!vehicleId || !status) return;

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { status } });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
}

export type CreateDriverState = { error: string };

export async function createDriverAction(
  _prevState: CreateDriverState,
  formData: FormData
): Promise<CreateDriverState> {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const licenseNo = String(formData.get("licenseNo") ?? "").trim();
  const salaryType = (formData.get("salaryType") as SalaryType) || "FIXED";
  const rawSalaryValue = Number(formData.get("salaryValue"));
  const salaryValue = Number.isFinite(rawSalaryValue) ? Math.max(0, rawSalaryValue) : 0;

  if (!vehicleId || !fullName || !phone || !password) {
    return { error: "Барча майдонларни тўлдиринг" };
  }
  if (password.length < 6) {
    return { error: "Парол камида 6 белгидан иборат бўлиши керак" };
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return { error: "Бу телефон рақам билан фойдаланувчи аллақачон мавжуд" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const now = new Date();
  const driver = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { fullName, phone, role: "DRIVER", passwordHash },
    });
    // Same free-then-assign rule as assignDriverAction, in case this vehicle
    // already had a driver.
    await tx.driver.updateMany({ where: { vehicleId }, data: { vehicleId: null } });
    // Close out whoever was previously logged as driving this vehicle, so
    // the assignment history shows a clean handoff instead of overlapping.
    await tx.driverAssignmentLog.updateMany({ where: { vehicleId, endedAt: null }, data: { endedAt: now } });
    const newDriver = await tx.driver.create({
      data: {
        userId: user.id,
        vehicleId,
        licenseNo: licenseNo || "—",
        salaryType,
        salaryValue,
        hiredAt: now,
      },
    });
    await tx.driverAssignmentLog.create({
      data: { vehicleId, driverId: newDriver.id, startedAt: now, endedAt: null },
    });
    return newDriver;
  });

  // Keep this month's Shift row in sync so the Smenalar pages show the same
  // driver immediately (see syncDriverVehicleAssignment for why).
  const month = currentMonthDate();
  await prisma.shift.deleteMany({ where: { driverId: driver.id, month, NOT: { vehicleId } } });
  await prisma.shift.upsert({
    where: { vehicleId_month: { vehicleId, month } },
    create: { vehicleId, driverId: driver.id, month },
    update: { driverId: driver.id },
  });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
  revalidatePath("/admin/users");
  revalidatePath("/mechanic/shifts");
  revalidatePath("/admin/shifts");
  revalidatePath("/dispatcher/shifts");
  redirect(`/mechanic/vehicles/${vehicleId}`);
}

export async function assignDriverAction(formData: FormData) {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const driverId = String(formData.get("driverId") ?? "").trim() || null;
  if (!vehicleId) return;

  await syncDriverVehicleAssignment(vehicleId, driverId);

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
  revalidatePath("/mechanic/shifts");
  revalidatePath("/admin/shifts");
  revalidatePath("/dispatcher/shifts");
}
