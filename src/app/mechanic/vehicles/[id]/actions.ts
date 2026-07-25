"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ExpenseCategory, Point, SalaryType, VehicleStatus, VehicleType } from "@prisma/client";

async function requireMechanic() {
  const session = await auth();
  if (!session || session.user.role !== "MECHANIC") {
    throw new Error("Ruxsat yo'q");
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
    return { error: "Barcha maydonlarni to'g'ri to'ldiring" };
  }

  const existing = await prisma.vehicle.findUnique({ where: { plate } });
  if (existing && existing.id !== vehicleId) {
    return { error: "Bu davlat raqami bilan boshqa mashina allaqachon mavjud" };
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
    return { error: "Barcha maydonlarni to'ldiring" };
  }
  if (password.length < 6) {
    return { error: "Parol kamida 6 belgidan iborat bo'lishi kerak" };
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return { error: "Bu telefon raqam bilan foydalanuvchi allaqachon mavjud" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { fullName, phone, role: "DRIVER", passwordHash },
    });
    // Same free-then-assign rule as assignDriverAction, in case this vehicle
    // already had a driver.
    await tx.driver.updateMany({ where: { vehicleId }, data: { vehicleId: null } });
    await tx.driver.create({
      data: {
        userId: user.id,
        vehicleId,
        licenseNo: licenseNo || "—",
        salaryType,
        salaryValue,
        hiredAt: new Date(),
      },
    });
  });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
  revalidatePath("/admin/users");
  redirect(`/mechanic/vehicles/${vehicleId}`);
}

export async function assignDriverAction(formData: FormData) {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const driverId = String(formData.get("driverId") ?? "").trim() || null;
  if (!vehicleId) return;

  // Driver.vehicleId is unique, so free up this vehicle from whoever holds it
  // first, then hand it to the newly selected driver (if any) in one go.
  await prisma.$transaction(async (tx) => {
    await tx.driver.updateMany({ where: { vehicleId }, data: { vehicleId: null } });
    if (driverId) {
      await tx.driver.update({ where: { id: driverId }, data: { vehicleId } });
    }
  });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
}
