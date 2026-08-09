"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { applyShiftAssignment } from "@/lib/driverAssignment";

async function requireDispatcher() {
  const session = await auth();
  if (!session || session.user.role !== "DISPATCHER" || !session.user.point) {
    throw new Error("Ruxsat yo'q");
  }
}

export async function assignShiftAction(formData: FormData) {
  await requireDispatcher();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const monthStr = String(formData.get("month") ?? "");
  const driverId = String(formData.get("driverId") ?? "").trim() || null;
  const month = new Date(`${monthStr}-01T00:00:00Z`);
  if (!vehicleId || Number.isNaN(month.getTime())) return;

  // The fleet is shared between both points, so any dispatcher can assign
  // any vehicle — no per-point ownership check (see shifts/page.tsx).
  await applyShiftAssignment(vehicleId, month, driverId);

  revalidatePath("/dispatcher/shifts");
  revalidatePath("/admin/shifts");
  revalidatePath("/mechanic/shifts");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
}
