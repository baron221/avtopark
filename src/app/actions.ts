"use server";

import { revalidatePath } from "next/cache";
import { signOut, auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// The known-plates list behind the "Бошқа кирим" autocomplete (see
// externalVehicle.ts) — both Dispatcher (who enters the income) and
// Mechanic (who's often first to recognize a new outside vehicle) can
// maintain it, so this lives at the app root rather than under either
// role's own actions file.
async function requireDispatcherOrMechanic() {
  const session = await auth();
  if (!session || (session.user.role !== "DISPATCHER" && session.user.role !== "MECHANIC")) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
}

function revalidateExternalVehiclePages() {
  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
  revalidatePath("/mechanic/vehicles");
}

export async function addExternalVehicleAction(formData: FormData) {
  const userId = await requireDispatcherOrMechanic();
  const plate = String(formData.get("plate") ?? "").trim().toUpperCase();
  if (!plate) return;

  await prisma.externalVehicle.upsert({
    where: { plate },
    create: { plate, createdBy: userId },
    update: {},
  });

  revalidateExternalVehiclePages();
}

export async function deleteExternalVehicleAction(formData: FormData) {
  await requireDispatcherOrMechanic();
  const id = String(formData.get("id") ?? "");
  await prisma.externalVehicle.delete({ where: { id } }).catch(() => {});

  revalidateExternalVehiclePages();
}
