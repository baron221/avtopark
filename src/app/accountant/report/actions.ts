"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { getCashBalance, type OwnerPayoutState } from "@/lib/ownerPayout";

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

/** Undoes an accidental "Қабул қилдим" click — back to pending (unconfirmed),
 * so it reappears in the pending list and drops back out of the confirmed
 * cash balance. The dispatcher's own handover record and any note on it are
 * untouched, only the accountant's confirmation. */
export async function revertCashReceiptAction(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    throw new Error("Рухсат йўқ");
  }

  const id = String(formData.get("id") ?? "");
  const handover = await prisma.cashHandover.findUnique({ where: { id } });
  if (!handover || !handover.accountantConfirmedAt) return;

  await prisma.cashHandover.update({
    where: { id },
    data: { accountantConfirmedBy: null, accountantConfirmedAt: null },
  });

  revalidatePath("/accountant/report");
}

export async function recordOwnerPayoutAction(
  _prevState: OwnerPayoutState,
  formData: FormData
): Promise<OwnerPayoutState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    throw new Error("Рухсат йўқ");
  }

  const amount = Math.round(Number(formData.get("amount")));
  const rawDate = String(formData.get("date") ?? "");
  const payoutDate = rawDate ? new Date(`${rawDate}T00:00:00Z`) : new Date();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };
  if (Number.isNaN(payoutDate.getTime())) return { error: "Санани тўғри киритинг" };

  // Re-derive the balance server-side rather than trusting anything the
  // client could have submitted — this directly guards real cash-on-hand.
  const balance = await getCashBalance();
  if (amount > balance) {
    return { error: `Қолдиқдан (${balance.toLocaleString("uz-UZ")} сўм) ортиқ бўлиши мумкин эмас` };
  }

  await prisma.ownerPayout.create({
    data: { amount: BigInt(amount), payoutDate, note, enteredBy: session.user.id },
  });

  revalidatePath("/accountant/report");
  return { error: "" };
}

export async function setCashOpeningBalanceAction(
  _prevState: OwnerPayoutState,
  formData: FormData
): Promise<OwnerPayoutState> {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    throw new Error("Рухсат йўқ");
  }

  const amount = Math.round(Number(formData.get("amount")));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount < 0) return { error: "Суммани тўғри киритинг" };

  // Deliberately the exact current moment, not a user-pickable date — this
  // is the cutoff every later aggregate filters by (`gte: since`). A
  // date-only value collapses to midnight, which would double-subtract
  // anything already recorded earlier that same day (already reflected in
  // the physically-counted amount) on top of counting it again here.
  await prisma.cashOpeningBalance.create({
    data: { amount: BigInt(amount), setDate: new Date(), note, enteredBy: session.user.id },
  });

  revalidatePath("/accountant/report");
  return { error: "" };
}
