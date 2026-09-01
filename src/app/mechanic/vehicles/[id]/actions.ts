"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { currentMonthDate, syncDriverVehicleAssignment } from "@/lib/driverAssignment";
import { hasModuleAccess } from "@/lib/access";
import { normalizePhone } from "@/lib/phone";
import { logDeletion } from "@/lib/deletionLog";
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

/** Deletes a generic vehicle Expense row — also used for the accountant's
 * "Машина" filter (see /accountant/expenses), which points here rather
 * than offering its own delete. If this expense turns out to be an
 * oil-change's paired row (see OilChange.expenseId), cascades to delete
 * that too, same as deleteOilChangeAction does from the other direction —
 * whichever list a mechanic deletes from, both stay in sync. */
export async function deleteVehicleExpenseAction(formData: FormData) {
  const userId = await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const expense = await prisma.expense.findUnique({ where: { id }, include: { vehicle: true, oilChange: true } });
  if (!expense) return;

  await logDeletion(
    "Expense",
    expense.id,
    `${expense.vehicle.plate} · ${expense.category} · ${expense.amount.toString()} сўм${expense.note ? ` · ${expense.note}` : ""}`,
    userId
  );

  await prisma.$transaction(async (tx) => {
    if (expense.oilChange) await tx.oilChange.delete({ where: { id: expense.oilChange.id } });
    await tx.expense.delete({ where: { id } });
    if (expense.oilChange) await revertVehicleOdometerIfStale(tx, expense.vehicleId, expense.oilChange.changedAt);
  });

  revalidatePath(`/mechanic/vehicles/${expense.vehicleId}`);
  revalidatePath("/mechanic/vehicles");
  revalidatePath("/accountant/expenses");
}

/** Deletes an oil-change entry and its paired Expense (see addOilChangeAction).
 * If this was the freshest known reading, falls back to whichever oil
 * change is now the latest (or clears odometerAsOf, falling back to
 * purchaseDate) — but leaves the vehicle untouched if a newer standalone
 * correction (UpdateOdometerForm) already superseded it. */
export async function deleteOilChangeAction(formData: FormData) {
  const userId = await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const oilChange = await prisma.oilChange.findUnique({ where: { id }, include: { vehicle: true } });
  if (!oilChange) return;

  await logDeletion(
    "OilChange",
    oilChange.id,
    `${oilChange.vehicle.plate} · ${oilChange.odometerKm.toLocaleString("uz-UZ")} км · ${oilChange.amount.toString()} сўм`,
    userId
  );

  await prisma.$transaction(async (tx) => {
    await tx.oilChange.delete({ where: { id } });
    if (oilChange.expenseId) await tx.expense.delete({ where: { id: oilChange.expenseId } });
    await revertVehicleOdometerIfStale(tx, oilChange.vehicleId, oilChange.changedAt);
  });

  revalidatePath(`/mechanic/vehicles/${oilChange.vehicleId}`);
  revalidatePath("/mechanic/vehicles");
  revalidatePath("/accountant/expenses");
}

// Shared by both delete actions above: only touches the vehicle's cached
// odometerKm/odometerAsOf when the just-deleted oil change was actually the
// source of that cached reading (changedAt matches exactly) — otherwise a
// later standalone correction already moved past it and nothing to fix.
async function revertVehicleOdometerIfStale(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  vehicleId: string,
  deletedChangedAt: Date
) {
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
  if (vehicle?.odometerAsOf?.getTime() !== deletedChangedAt.getTime()) return;

  const newLatest = await tx.oilChange.findFirst({ where: { vehicleId }, orderBy: { changedAt: "desc" } });
  await tx.vehicle.update({
    where: { id: vehicleId },
    data: newLatest ? { odometerKm: newLatest.odometerKm, odometerAsOf: newLatest.changedAt } : { odometerAsOf: null },
  });
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

  // Expense created first so its id can be stored on the OilChange, same
  // pattern as addFuelLogAction — letting deleteOilChangeAction keep both
  // rows in sync later instead of orphaning one of them.
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        vehicleId,
        category: "REPAIR",
        amount: BigInt(Math.round(amount)),
        expenseDate: changedAt,
        note: note ? `Мой алмаштириш · ${note}` : "Мой алмаштириш",
        enteredBy: userId,
      },
    });
    await tx.oilChange.create({
      data: {
        vehicleId,
        changedAt,
        odometerKm,
        intervalKm,
        intervalMonths,
        amount: BigInt(Math.round(amount)),
        note,
        enteredBy: userId,
        expenseId: expense.id,
      },
    });
    await tx.vehicle.update({ where: { id: vehicleId }, data: { odometerKm, odometerAsOf: changedAt } });
  });

  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/mechanic/vehicles");
}

/** Corrects the vehicle's known odometer without recording an oil change —
 * for when the GPS estimate has drifted from the real dashboard reading
 * but the oil isn't actually due yet. Doesn't touch OilChange/intervalKm,
 * so "when is the next change due" is unaffected — only the current-km
 * estimate's baseline moves forward to this reading's date (see
 * resolveOdometerBase). */
export async function updateOdometerAction(formData: FormData) {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const odometerKm = Math.round(Number(formData.get("odometerKm") ?? 0));
  if (!vehicleId || !(odometerKm > 0)) return;

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { odometerKm, odometerAsOf: new Date() } });

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
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
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
