"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireMechanic() {
  const session = await auth();
  if (!session || session.user.role !== "MECHANIC") {
    throw new Error("Ruxsat yo'q");
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
