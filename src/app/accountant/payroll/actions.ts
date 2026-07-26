"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNetPay } from "@/lib/payroll";
import { hasModuleAccess } from "@/lib/access";

async function requireAccountant() {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    throw new Error("Ruxsat yo'q");
  }
  return session.user.id;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function generatePayrollAction() {
  await requireAccountant();

  const now = new Date();
  const month = monthStart(now);
  const from = month;
  const to = monthEnd(now);

  const users = await prisma.user.findMany({ where: { role: { not: "OWNER" }, isActive: true } });

  for (const user of users) {
    const existing = await prisma.salary.findUnique({ where: { userId_month: { userId: user.id, month } } });
    if (existing && existing.status !== "DRAFT") continue;

    const [finesAgg, lunchAgg] = await Promise.all([
      prisma.fine.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, deducted: true, fineDate: { gte: from, lte: to } },
      }),
      prisma.lunch.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, lunchDate: { gte: from, lte: to } },
      }),
    ]);

    const baseSalary = user.baseSalary ?? BigInt(0);
    const bonus = existing?.bonus ?? BigInt(0);
    const finesTotal = finesAgg._sum.amount ?? BigInt(0);
    const lunchTotal = lunchAgg._sum.amount ?? BigInt(0);
    const netPay = computeNetPay({ baseSalary, bonus, finesTotal, lunchTotal });

    await prisma.salary.upsert({
      where: { userId_month: { userId: user.id, month } },
      create: { userId: user.id, month, baseSalary, bonus, finesTotal, lunchTotal, netPay, status: "DRAFT" },
      update: { baseSalary, finesTotal, lunchTotal, netPay },
    });
  }

  revalidatePath("/accountant/payroll");
}

export async function approvePayrollAction() {
  const userId = await requireAccountant();
  const month = monthStart(new Date());

  await prisma.salary.updateMany({
    where: { month, status: "DRAFT" },
    data: { status: "APPROVED", approvedBy: userId },
  });

  revalidatePath("/accountant/payroll");
}

export async function setBonusAction(formData: FormData) {
  await requireAccountant();

  const salaryId = String(formData.get("salaryId") ?? "");
  const rawBonus = Number(formData.get("bonus"));
  const bonus = BigInt(Number.isFinite(rawBonus) ? Math.max(0, Math.round(rawBonus)) : 0);

  const salary = await prisma.salary.findUnique({ where: { id: salaryId } });
  if (!salary || salary.status !== "DRAFT") return;

  const netPay = computeNetPay({
    baseSalary: salary.baseSalary,
    bonus,
    finesTotal: salary.finesTotal,
    lunchTotal: salary.lunchTotal,
  });
  await prisma.salary.update({ where: { id: salaryId }, data: { bonus, netPay } });

  revalidatePath("/accountant/payroll");
}
