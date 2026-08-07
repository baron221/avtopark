"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { logDeletion } from "@/lib/deletionLog";

async function requireMechanic() {
  const session = await auth();
  if (!session || (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "FUEL")))) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
}

export async function addStationPaymentInstallmentAction(formData: FormData) {
  await requireMechanic();
  const paymentId = String(formData.get("paymentId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!paymentId || !(amount > 0)) return;

  const payment = await prisma.stationPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return;

  const newPaid = Number(payment.paidAmount) + amount;
  const status = newPaid >= Number(payment.amount) ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";

  await prisma.stationPayment.update({
    where: { id: paymentId },
    data: {
      paidAmount: BigInt(Math.round(newPaid)),
      status,
      paidAt: status === "PAID" ? new Date() : payment.paidAt,
    },
  });

  revalidatePath("/mechanic/fuel/payments");
  revalidatePath("/mechanic/fuel");
}

export type UpdateStationPaymentState = { error: string };

export async function updateStationPaymentAction(
  _prevState: UpdateStationPaymentState,
  formData: FormData
): Promise<UpdateStationPaymentState> {
  await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const stationId = String(formData.get("stationId") ?? "");
  const periodStart = new Date(String(formData.get("periodStart") ?? ""));
  const periodEnd = new Date(String(formData.get("periodEnd") ?? ""));
  const totalVolume = Number(formData.get("totalVolume") ?? 0);
  const amount = Number(formData.get("amount") ?? 0);
  if (
    !id ||
    !stationId ||
    !(totalVolume > 0) ||
    !(amount > 0) ||
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime())
  ) {
    return { error: "Барча майдонларни тўғри тўлдиринг" };
  }

  const payment = await prisma.stationPayment.findUnique({ where: { id } });
  if (!payment) return { error: "Ёзув топилмади" };

  // Re-derive status from the (possibly changed) total against what's
  // already been paid, same rule addStationPaymentInstallmentAction uses.
  const paidAmount = Number(payment.paidAmount);
  const roundedAmount = Math.round(amount);
  const status = paidAmount >= roundedAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";

  await prisma.stationPayment.update({
    where: { id },
    data: {
      stationId,
      periodStart,
      periodEnd,
      totalVolume,
      amount: BigInt(roundedAmount),
      status,
      paidAt: status === "PAID" ? (payment.paidAt ?? new Date()) : null,
    },
  });

  revalidatePath("/mechanic/fuel/payments");
  revalidatePath("/mechanic/fuel");
  redirect("/mechanic/fuel/payments");
}

export async function deleteStationPaymentAction(formData: FormData) {
  const userId = await requireMechanic();

  const id = String(formData.get("id") ?? "");
  const payment = await prisma.stationPayment.findUnique({ where: { id }, include: { station: true } });
  if (!payment) return;

  await logDeletion(
    "StationPayment",
    payment.id,
    `${payment.station.name} · ${payment.amount.toString()} сўм · ${payment.status}`,
    userId
  );
  await prisma.stationPayment.delete({ where: { id } });

  revalidatePath("/mechanic/fuel/payments");
  revalidatePath("/mechanic/fuel");
}

export async function addStationPaymentAction(formData: FormData) {
  const userId = await requireMechanic();

  const stationId = String(formData.get("stationId") ?? "");
  const periodStart = new Date(String(formData.get("periodStart") ?? ""));
  const periodEnd = new Date(String(formData.get("periodEnd") ?? ""));
  const totalVolume = Number(formData.get("totalVolume") ?? 0);
  const amount = Number(formData.get("amount") ?? 0);
  if (
    !stationId ||
    !(totalVolume > 0) ||
    !(amount > 0) ||
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime())
  ) {
    return;
  }

  await prisma.stationPayment.create({
    data: {
      stationId,
      periodStart,
      periodEnd,
      totalVolume,
      amount: BigInt(Math.round(amount)),
      status: "PENDING",
      enteredBy: userId,
    },
  });

  revalidatePath("/mechanic/fuel/payments");
  revalidatePath("/mechanic/fuel");
}
