"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";
import type { StaffExpenseCategory, StaffExpensePoint } from "@prisma/client";

const CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  OBED: "Обед",
  BOSHQA: "Бошқа",
};

export type AddExpenseState = { error: string };

export async function addStaffExpenseAction(
  _prevState: AddExpenseState,
  formData: FormData
): Promise<AddExpenseState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const point = formData.get("point") as StaffExpensePoint;
  const category = formData.get("category") as StaffExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!point || !category || !(amount > 0)) {
    return { error: "Пункт, тоифа ва суммани тўғри киритинг" };
  }

  await prisma.staffExpense.create({
    data: {
      userId: session.user.id,
      point,
      category,
      amount: BigInt(Math.round(amount)),
      note,
      expenseDate: new Date(),
      enteredBy: session.user.id,
    },
  });

  revalidatePath("/accountant/expenses");
  redirect("/accountant/expenses");
}

export type UpdateExpenseState = { error: string };

export async function updateExpenseAction(
  _prevState: UpdateExpenseState,
  formData: FormData
): Promise<UpdateExpenseState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const id = String(formData.get("id") ?? "");
  const point = formData.get("point") as StaffExpensePoint;
  const category = formData.get("category") as StaffExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!point || !category || !(amount > 0)) {
    return { error: "Пункт, тоифа ва суммани тўғри киритинг" };
  }

  const expense = await prisma.staffExpense.findUnique({ where: { id } });
  if (!expense) return { error: "Ёзув топилмади" };

  await prisma.staffExpense.update({
    where: { id },
    data: { point, category, amount: BigInt(Math.round(amount)), note },
  });

  revalidatePath("/accountant/expenses");
  redirect("/accountant/expenses");
}

export async function deleteExpenseAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) return;

  const id = String(formData.get("id") ?? "");
  const expense = await prisma.staffExpense.findUnique({ where: { id } });
  if (!expense) return;

  await logDeletion(
    "StaffExpense",
    expense.id,
    `${CATEGORY_LABELS[expense.category] ?? expense.category} · ${expense.amount.toString()} сўм${expense.note ? ` · ${expense.note}` : ""}`,
    session.user.id
  );
  await prisma.staffExpense.delete({ where: { id } });

  revalidatePath("/accountant/expenses");
}
