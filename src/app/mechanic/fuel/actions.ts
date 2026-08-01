"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";

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

  const filledAt = new Date();

  // Also record a matching Expense (category FUEL) so this cost is counted
  // in profit/expense reports — FuelLog alone was invisible to those, since
  // getOwnerDashboardVM only aggregates the Expense table, not FuelLog.
  await prisma.$transaction([
    prisma.fuelLog.create({
      data: {
        stationId,
        vehicleId,
        driverId: driver.id,
        volume,
        amount: BigInt(Math.round(amount)),
        filledAt,
        enteredBy: userId,
      },
    }),
    prisma.expense.create({
      data: {
        vehicleId,
        driverId: driver.id,
        category: "FUEL",
        amount: BigInt(Math.round(amount)),
        expenseDate: filledAt,
        note: "Ёқилғи",
        enteredBy: userId,
      },
    }),
  ]);

  revalidatePath("/mechanic/fuel");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
}
