"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";
import { monthStart } from "@/lib/month";

export type GiveAdvanceState = { error: string };

export async function giveAdvanceAction(
  _prevState: GiveAdvanceState,
  formData: FormData
): Promise<GiveAdvanceState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!userId || !(amount > 0)) {
    return { error: "Ходим ва суммани тўғри киритинг" };
  }

  const now = new Date();
  await prisma.advance.create({
    data: {
      userId,
      amount: BigInt(Math.round(amount)),
      givenDate: now,
      month: monthStart(now),
      enteredBy: session.user.id,
    },
  });

  revalidatePath("/accountant/advances");
  revalidatePath("/accountant/payroll");
  redirect("/accountant/advances");
}

export type UpdateAdvanceState = { error: string };

export async function updateAdvanceAction(
  _prevState: UpdateAdvanceState,
  formData: FormData
): Promise<UpdateAdvanceState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  const advance = await prisma.advance.findUnique({ where: { id } });
  if (!advance) return { error: "Ёзув топилмади" };

  await prisma.advance.update({ where: { id }, data: { amount: BigInt(Math.round(amount)) } });

  revalidatePath("/accountant/advances");
  revalidatePath("/accountant/payroll");
  redirect("/accountant/advances");
}

export async function deleteAdvanceAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) return;

  const id = String(formData.get("id") ?? "");
  const advance = await prisma.advance.findUnique({ where: { id }, include: { user: true } });
  if (!advance) return;

  await logDeletion(
    "Advance",
    advance.id,
    `Аванс · ${advance.user.fullName} · ${advance.amount.toString()} сўм`,
    session.user.id
  );
  await prisma.advance.delete({ where: { id } });

  revalidatePath("/accountant/advances");
  revalidatePath("/accountant/payroll");
}
