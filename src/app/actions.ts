"use server";

import { revalidatePath } from "next/cache";
import { signOut, auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// The known-plates list behind the "Бошқа кирим" autocomplete (see
// externalVehicle.ts) — Dispatcher (who enters the income), Mechanic
// (who's often first to recognize a new outside vehicle), and Accountant
// (who records these vehicles' monthly service payments — see
// accountant/income) can all maintain it, so this lives at the app root
// rather than under any one role's own actions file.
async function requireDispatcherMechanicOrAccountant() {
  const session = await auth();
  const role = session?.user.role;
  if (!session || (role !== "DISPATCHER" && role !== "MECHANIC" && role !== "ACCOUNTANT")) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
}

function revalidateExternalVehiclePages() {
  revalidatePath("/dispatcher/journal");
  revalidatePath("/dispatcher/point");
  revalidatePath("/mechanic/vehicles");
  revalidatePath("/accountant/income/new");
}

export async function addExternalVehicleAction(formData: FormData) {
  const userId = await requireDispatcherMechanicOrAccountant();
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
  await requireDispatcherMechanicOrAccountant();
  const id = String(formData.get("id") ?? "");
  await prisma.externalVehicle.delete({ where: { id } }).catch(() => {});

  revalidateExternalVehiclePages();
}
