"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyShiftAssignment } from "@/lib/driverAssignment";

async function requireDispatcher() {
  const session = await auth();
  if (!session || session.user.role !== "DISPATCHER" || !session.user.point) {
    throw new Error("Ruxsat yo'q");
  }
  return session.user.point;
}

export async function assignShiftAction(formData: FormData) {
  const point = await requireDispatcher();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const monthStr = String(formData.get("month") ?? "");
  const driverId = String(formData.get("driverId") ?? "").trim() || null;
  const month = new Date(`${monthStr}-01T00:00:00Z`);
  if (!vehicleId || Number.isNaN(month.getTime())) return;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.point !== point) return;

  await applyShiftAssignment(vehicleId, month, driverId);

  revalidatePath("/dispatcher/shifts");
  revalidatePath("/admin/shifts");
  revalidatePath("/mechanic/shifts");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
}
