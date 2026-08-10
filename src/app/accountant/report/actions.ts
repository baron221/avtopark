"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";

export async function confirmCashReceiptAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    throw new Error("Рухсат йўқ");
  }

  const id = String(formData.get("id") ?? "");
  const handover = await prisma.cashHandover.findUnique({ where: { id } });
  if (!handover || handover.accountantConfirmedAt) return;

  await prisma.cashHandover.update({
    where: { id },
    data: { accountantConfirmedBy: session.user.id, accountantConfirmedAt: new Date() },
  });

  revalidatePath("/accountant/report");
}

export async function confirmPlanReceiptAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    throw new Error("Рухсат йўқ");
  }

  const id = String(formData.get("id") ?? "");
  const handover = await prisma.planHandover.findUnique({ where: { id } });
  if (!handover || handover.confirmedAt) return;

  await prisma.planHandover.update({
    where: { id },
    data: { confirmedBy: session.user.id, confirmedAt: new Date() },
  });

  revalidatePath("/accountant/report");
}
