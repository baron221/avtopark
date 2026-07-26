"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { applyShiftAssignment } from "@/lib/driverAssignment";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Ruxsat yo'q");
  }
}

export async function assignShiftAction(formData: FormData) {
  await requireAdmin();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const monthStr = String(formData.get("month") ?? "");
  const driverId = String(formData.get("driverId") ?? "").trim() || null;
  const month = new Date(`${monthStr}-01T00:00:00Z`);
  if (!vehicleId || Number.isNaN(month.getTime())) return;

  await applyShiftAssignment(vehicleId, month, driverId);

  revalidatePath("/admin/shifts");
  revalidatePath("/dispatcher/shifts");
  revalidatePath("/mechanic/shifts");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
  revalidatePath("/fleet/shifts");
}
