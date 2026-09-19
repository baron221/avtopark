"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logDeletion } from "@/lib/deletionLog";
import { formatSom } from "@/lib/format";

export type OwnerBalanceExpenseState = { error: string };

async function requireAccountant() {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") throw new Error("Рухсат йўқ");
  return session.user.id;
}

function revalidateEveryone() {
  revalidatePath("/accountant/owner-balance");
  revalidatePath("/owner");
  revalidatePath("/admin/panel");
  revalidatePath("/mechanic/fuel");
}

/** Records money the owner spent out of their own balance on something that
 * isn't already tracked elsewhere (fuel-station payments and oil changes
 * are read straight from their own tables — see getMechanicCostSummary). */
export async function addOwnerBalanceExpenseAction(
  _prev: OwnerBalanceExpenseState,
  formData: FormData
): Promise<OwnerBalanceExpenseState> {
  const userId = await requireAccountant();

  const amount = Math.round(Number(formData.get("amount") ?? 0));
  const note = String(formData.get("note") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  if (!(amount > 0)) return { error: "Суммани киритинг" };
  if (!note) return { error: "Нимага сарфланганини ёзинг" };

  // Midday UTC so the picked calendar day can't shift with the server's
  // timezone — same convention as the other backdatable forms.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T12:00:00Z`) : null;
  const expenseDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  if (expenseDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { error: "Келажак санани танлаб бўлмайди" };

  await prisma.ownerBalanceExpense.create({
    data: { amount: BigInt(amount), expenseDate, note, enteredBy: userId },
  });

  revalidateEveryone();
  return { error: "" };
}

export async function deleteOwnerBalanceExpenseAction(formData: FormData) {
  const userId = await requireAccountant();

  const id = String(formData.get("id") ?? "");
  const row = await prisma.ownerBalanceExpense.findUnique({ where: { id } });
  if (!row) return;

  await logDeletion("OwnerBalanceExpense", row.id, `${formatSom(Number(row.amount))} сўм · ${row.note}`, userId);
  await prisma.ownerBalanceExpense.delete({ where: { id } });

  revalidateEveryone();
}
