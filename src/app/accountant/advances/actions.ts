"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export type GiveAdvanceState = { error: string };

export async function giveAdvanceAction(
  _prevState: GiveAdvanceState,
  formData: FormData
): Promise<GiveAdvanceState> {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") {
    return { error: "Ruxsat yo'q" };
  }

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!userId || !(amount > 0)) {
    return { error: "Xodim va summani to'g'ri kiriting" };
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
