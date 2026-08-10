"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// A driver on the fixed daily "plan" arrangement reports what they paid the
// company today — there's no live source for this amount (unlike trip
// revenue) and no pre-set target, so the driver types it themselves. One
// report per driver per day; a second submit the same day is a no-op.
export async function reportPlanHandoverAction(formData: FormData) {
  const session = await auth();
  if (!session || session.user.role !== "DRIVER") throw new Error("Рухсат йўқ");

  const driver = await prisma.driver.findUnique({ where: { userId: session.user.id } });
  if (!driver || !driver.vehicleId) return;

  const rawAmount = Number(formData.get("amount"));
  const amount = BigInt(Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0);
  if (amount <= BigInt(0)) return;

  const today = startOfDay(new Date());
  const existing = await prisma.planHandover.findUnique({
    where: { driverId_handoverDate: { driverId: driver.id, handoverDate: today } },
  });
  if (existing) return;

  await prisma.planHandover.create({
    data: {
      vehicleId: driver.vehicleId,
      driverId: driver.id,
      handoverDate: today,
      amount,
      reportedBy: session.user.id,
      reportedAt: new Date(),
    },
  });

  revalidatePath("/driver");
  revalidatePath("/accountant/report");
}
