"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";

async function requireMechanic() {
  const session = await auth();
  if (!session || (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "FUEL")))) {
    throw new Error("Ruxsat yo'q");
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

  await prisma.fuelLog.create({
    data: {
      stationId,
      vehicleId,
      driverId: driver.id,
      volume,
      amount: BigInt(Math.round(amount)),
      filledAt: new Date(),
      enteredBy: userId,
    },
  });

  revalidatePath("/mechanic/fuel");
}
