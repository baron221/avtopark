"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { applyShiftAssignment } from "@/lib/driverAssignment";
import { hasModuleAccess } from "@/lib/access";

async function requireMechanic() {
  const session = await auth();
  if (!session || (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "SHIFTS")))) {
    throw new Error("Рухсат йўқ");
  }
}

export async function assignShiftAction(formData: FormData) {
  await requireMechanic();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const monthStr = String(formData.get("month") ?? "");
  const driverId = String(formData.get("driverId") ?? "").trim() || null;
  const month = new Date(`${monthStr}-01T00:00:00Z`);
  if (!vehicleId || Number.isNaN(month.getTime())) return;

  await applyShiftAssignment(vehicleId, month, driverId);

  revalidatePath("/mechanic/shifts");
  revalidatePath("/admin/shifts");
  revalidatePath("/dispatcher/shifts");
  revalidatePath("/mechanic/vehicles");
  revalidatePath(`/mechanic/vehicles/${vehicleId}`);
}
