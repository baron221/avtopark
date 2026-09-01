"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { OTHER_INCOME_CATEGORIES } from "@/lib/otherIncome";
import type { Point, OtherIncomeCategory } from "@prisma/client";

export type AddOtherIncomeState = { error: string };

/** Accountant's own entry point for OtherIncome — separate from the
 * dispatcher's (see dispatcher/actions.ts's own addOtherIncomeAction),
 * since this isn't tied to a dispatcher's point-of-the-day the way trip
 * revenue is: an accountant can record any point's income directly. Same
 * OtherIncome table either way, so both feed the same reports. */
export async function addOtherIncomeAction(
  _prevState: AddOtherIncomeState,
  formData: FormData
): Promise<AddOtherIncomeState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return { error: "Рухсат йўқ" };
  }

  const point = formData.get("point") as Point;
  const rawCategory = String(formData.get("category") ?? "");
  const category: OtherIncomeCategory = OTHER_INCOME_CATEGORIES.includes(rawCategory as OtherIncomeCategory)
    ? (rawCategory as OtherIncomeCategory)
    : "BOSHQA";
  const amount = Number(formData.get("amount") ?? 0);
  const plateNumber = String(formData.get("plateNumber") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (point !== "FARGONA" && point !== "QUVA") return { error: "Пунктни танланг" };
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  await prisma.otherIncome.create({
    data: {
      point,
      category,
      amount: BigInt(Math.round(amount)),
      note,
      plateNumber,
      incomeDate: new Date(),
      enteredBy: session.user.id,
    },
  });

  revalidatePath("/accountant/income/new");
  revalidatePath("/accountant/report");
  redirect("/accountant/income/new?saved=1");
}
