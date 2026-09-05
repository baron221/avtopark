"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";
import type { FuelType, PayPeriod } from "@prisma/client";

async function requireMechanic() {
  const session = await auth();
  if (!session || (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "FUEL")))) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
}

export async function addFuelLogAction(formData: FormData) {
  const userId = await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const stationId = String(formData.get("stationId") ?? "");
  const volume = Number(formData.get("volume") ?? 0);
  const amount = Number(formData.get("amount") ?? 0);
  if (!vehicleId || !stationId || !(volume > 0) || !(amount > 0)) return;

  const driver = await prisma.driver.findUnique({ where: { vehicleId } });
  if (!driver) return;

  // Defaults to today, but the mechanic can pick a past date to backfill an
  // earlier fill-up that was never entered at the time.
  const filledAtStr = String(formData.get("filledAt") ?? "");
  const parsedFilledAt = filledAtStr ? new Date(`${filledAtStr}T12:00:00Z`) : null;
  const filledAt = parsedFilledAt && !Number.isNaN(parsedFilledAt.getTime()) ? parsedFilledAt : new Date();

  // Also record a matching Expense (category FUEL) so this cost is counted
  // in profit/expense reports — FuelLog alone was invisible to those, since
  // getOwnerDashboardVM only aggregates the Expense table, not FuelLog. The
  // Expense is created first so its id can be stored on the FuelLog, letting
  // edit/delete keep both rows in sync later.
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        vehicleId,
        driverId: driver.id,
        category: "FUEL",
        amount: BigInt(Math.round(amount)),
        expenseDate: filledAt,
        note: "Ёқилғи",
        enteredBy: userId,
      },
    });
    await tx.fuelLog.create({
      data: {
        stationId,
        vehicleId,
        driverId: driver.id,
        expenseId: expense.id,
        volume,
        amount: BigInt(Math.round(amount)),
        filledAt,
        enteredBy: userId,
      },
    });
  });

  revalidatePath("/mechanic/fuel");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
}

export type UpdateFuelLogState = { error: string };

export async function updateFuelLogAction(
  _prevState: UpdateFuelLogState,
  formData: FormData
): Promise<UpdateFuelLogState> {
  await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const stationId = String(formData.get("stationId") ?? "");
  const volume = Number(formData.get("volume") ?? 0);
  const amount = Number(formData.get("amount") ?? 0);
  const filledAtStr = String(formData.get("filledAt") ?? "");
  const parsedFilledAt = filledAtStr ? new Date(`${filledAtStr}T12:00:00Z`) : null;
  if (
    !id ||
    !vehicleId ||
    !stationId ||
    !(volume > 0) ||
    !(amount > 0) ||
    !parsedFilledAt ||
    Number.isNaN(parsedFilledAt.getTime())
  ) {
    return { error: "Барча майдонларни тўғри тўлдиринг" };
  }

  const fuelLog = await prisma.fuelLog.findUnique({ where: { id } });
  if (!fuelLog) return { error: "Ёзув топилмади" };

  const driver = await prisma.driver.findUnique({ where: { vehicleId } });
  if (!driver) return { error: "Бу машинага ҳайдовчи бириктирилмаган" };

  await prisma.$transaction(async (tx) => {
    await tx.fuelLog.update({
      where: { id },
      data: {
        vehicleId,
        stationId,
        driverId: driver.id,
        volume,
        amount: BigInt(Math.round(amount)),
        filledAt: parsedFilledAt,
      },
    });
    // Older rows (created before FuelLog.expenseId existed) have no linked
    // expense to keep in sync — best-effort, leaves the FuelLog itself
    // correctable either way.
    if (fuelLog.expenseId) {
      await tx.expense.update({
        where: { id: fuelLog.expenseId },
        data: { vehicleId, driverId: driver.id, amount: BigInt(Math.round(amount)), expenseDate: parsedFilledAt },
      });
    }
  });

  revalidatePath("/mechanic/fuel");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  if (fuelLog.vehicleId !== vehicleId) revalidatePath(`/mechanic/vehicles/${fuelLog.vehicleId}`);
  redirect("/mechanic/fuel");
}

export async function deleteFuelLogAction(formData: FormData) {
  const userId = await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const fuelLog = await prisma.fuelLog.findUnique({ where: { id }, include: { vehicle: true, station: true } });
  if (!fuelLog) return;

  await logDeletion(
    "FuelLog",
    fuelLog.id,
    `${fuelLog.vehicle.plate} · ${fuelLog.station.name} · ${Number(fuelLog.volume)} · ${fuelLog.amount.toString()} сўм`,
    userId
  );

  await prisma.$transaction(async (tx) => {
    await tx.fuelLog.delete({ where: { id } });
    if (fuelLog.expenseId) await tx.expense.delete({ where: { id: fuelLog.expenseId } });
  });

  revalidatePath("/mechanic/fuel");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${fuelLog.vehicleId}`);
}

export async function addFuelStationAction(formData: FormData) {
  await requireMechanic();

  const name = String(formData.get("name") ?? "").trim();
  const fuelType = formData.get("fuelType") as FuelType;
  const contractNo = String(formData.get("contractNo") ?? "").trim();
  const unitPrice = Math.round(Number(formData.get("unitPrice") ?? 0));
  const payPeriod = formData.get("payPeriod") as PayPeriod;
  if (!name || !fuelType || !contractNo || !(unitPrice > 0) || !payPeriod) return;

  await prisma.fuelStation.create({
    data: { name, fuelType, contractNo, unitPrice: BigInt(unitPrice), payPeriod, isActive: true },
  });

  revalidatePath("/mechanic/fuel");
}

/** Lets a mechanic update a station's price (or name/contract/pay period)
 * after the fact — addFuelStationAction only ever set these once at
 * creation, so a real price increase had no way to reach the app short of
 * deleting and re-adding the station under a new id (losing its history
 * link and cluttering the list). FuelLogForm's own suggested amount
 * (volume × unitPrice) picks this up immediately since it always reads the
 * station's current row, not a snapshot. */
export async function updateFuelStationAction(formData: FormData) {
  await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const fuelType = formData.get("fuelType") as FuelType;
  const contractNo = String(formData.get("contractNo") ?? "").trim();
  const unitPrice = Math.round(Number(formData.get("unitPrice") ?? 0));
  const payPeriod = formData.get("payPeriod") as PayPeriod;
  if (!id || !name || !fuelType || !contractNo || !(unitPrice > 0) || !payPeriod) return;

  await prisma.fuelStation.update({
    where: { id },
    data: { name, fuelType, contractNo, unitPrice: BigInt(unitPrice), payPeriod },
  });

  revalidatePath("/mechanic/fuel");
}

export async function deleteFuelStationAction(formData: FormData) {
  await requireMechanic();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await prisma.fuelStation.delete({ where: { id } });
  } catch {
    // Has real fuel-log/payment history — deleting would orphan those rows
    // (or fail outright on the FK), so just hide it from future selection
    // instead, same as blocking a driver with real trip history rather
    // than deleting them (see admin/users/actions.ts's deleteUserAction).
    await prisma.fuelStation.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath("/mechanic/fuel");
}
