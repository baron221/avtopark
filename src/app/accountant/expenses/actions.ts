"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { StaffExpenseCategory, StaffExpensePoint } from "@prisma/client";

export type AddExpenseState = { error: string };

export async function addStaffExpenseAction(
  _prevState: AddExpenseState,
  formData: FormData
): Promise<AddExpenseState> {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") {
    return { error: "Ruxsat yo'q" };
  }

  const point = formData.get("point") as StaffExpensePoint;
  const category = formData.get("category") as StaffExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!point || !category || !(amount > 0)) {
    return { error: "Punkt, toifa va summani to'g'ri kiriting" };
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
