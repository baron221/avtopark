"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ShiftType } from "@prisma/client";

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
  const shiftType = formData.get("shiftType") as ShiftType;
  const dateStr = String(formData.get("date") ?? "");
  const driverId = String(formData.get("driverId") ?? "");
  const shiftDate = new Date(`${dateStr}T00:00:00`);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.point !== point) return;

  const startTime = new Date(shiftDate);
  const endTime = new Date(shiftDate);
  if (shiftType === "MORNING") {
    startTime.setHours(6, 0, 0, 0);
    endTime.setHours(14, 0, 0, 0);
  } else {
    startTime.setHours(14, 0, 0, 0);
    endTime.setHours(22, 0, 0, 0);
  }

  if (!driverId) {
    await prisma.shift.deleteMany({ where: { vehicleId, shiftDate, shiftType } });
  } else {
    await prisma.shift.upsert({
      where: { vehicleId_shiftDate_shiftType: { vehicleId, shiftDate, shiftType } },
      create: { vehicleId, driverId, shiftDate, shiftType, startTime, endTime },
      update: { driverId, startTime, endTime },
    });
  }

  revalidatePath("/dispatcher/shifts");
}
