"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";

export type AddFineState = { error: string };

export async function addFineAction(_prevState: AddFineState, formData: FormData): Promise<AddFineState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !(amount > 0) || !reason) {
    return { error: "Ходим, сумма ва сабабни тўғри киритинг" };
  }

  await prisma.fine.create({
    data: {
      userId,
      amount: BigInt(Math.round(amount)),
      reason,
      fineDate: new Date(),
      deducted: true,
      enteredBy: session.user.id,
    },
  });

  revalidatePath("/accountant/fines");
  revalidatePath("/accountant/payroll");
  redirect("/accountant/fines");
}

export async function toggleFineDeductedAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) return;

  const fineId = String(formData.get("fineId") ?? "");
  const fine = await prisma.fine.findUnique({ where: { id: fineId } });
  if (!fine) return;

  await prisma.fine.update({ where: { id: fineId }, data: { deducted: !fine.deducted } });

  revalidatePath("/accountant/fines");
  revalidatePath("/accountant/payroll");
}

export type UpdateFineState = { error: string };

export async function updateFineAction(_prevState: UpdateFineState, formData: FormData): Promise<UpdateFineState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!(amount > 0) || !reason) return { error: "Сумма ва сабабни тўғри киритинг" };

  const fine = await prisma.fine.findUnique({ where: { id } });
  if (!fine) return { error: "Ёзув топилмади" };

  await prisma.fine.update({ where: { id }, data: { amount: BigInt(Math.round(amount)), reason } });

  revalidatePath("/accountant/fines");
  revalidatePath("/accountant/payroll");
  redirect("/accountant/fines");
}

export async function deleteFineAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) return;

  const id = String(formData.get("id") ?? "");
  const fine = await prisma.fine.findUnique({ where: { id }, include: { user: true } });
  if (!fine) return;

  await logDeletion(
    "Fine",
    fine.id,
    `Жарима · ${fine.user.fullName} · ${fine.reason} · ${fine.amount.toString()} сўм`,
    session.user.id
  );
  await prisma.fine.delete({ where: { id } });

  revalidatePath("/accountant/fines");
  revalidatePath("/accountant/payroll");
}
