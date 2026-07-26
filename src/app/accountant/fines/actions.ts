"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";

export type AddFineState = { error: string };

export async function addFineAction(_prevState: AddFineState, formData: FormData): Promise<AddFineState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Ruxsat yo'q" };
  }

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !(amount > 0) || !reason) {
    return { error: "Xodim, summa va sababni to'g'ri kiriting" };
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
