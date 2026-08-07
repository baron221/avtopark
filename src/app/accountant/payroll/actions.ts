"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNetPay } from "@/lib/payroll";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";

async function requireAccountant() {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
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

    const [finesAgg, advancesAgg] = await Promise.all([
      prisma.fine.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, deducted: true, fineDate: { gte: from, lte: to } },
      }),
      prisma.advance.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, month },
      }),
    ]);

    const baseSalary = user.baseSalary ?? BigInt(0);
    const bonus = existing?.bonus ?? BigInt(0);
    const finesTotal = finesAgg._sum.amount ?? BigInt(0);
    const advancesTotal = advancesAgg._sum.amount ?? BigInt(0);
    const netPay = computeNetPay({ baseSalary, bonus, advancesTotal, finesTotal });

    await prisma.salary.upsert({
      where: { userId_month: { userId: user.id, month } },
      create: { userId: user.id, month, baseSalary, bonus, advancesTotal, finesTotal, netPay, status: "DRAFT" },
      update: { baseSalary, advancesTotal, finesTotal, netPay },
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

// An approved Salary is deliberately frozen — generatePayrollAction skips it,
// so a fine/advance added afterward (e.g. a fine dated after approval, or an
// approval that happened before the fine was even entered) would otherwise
// never make it in. Reverting unlocks it so regenerating picks the change up.
// Only for the current month — reopening a closed past month is a real
// payroll-integrity risk (money may already be out the door).
export async function revertSalaryToDraftAction(formData: FormData) {
  await requireAccountant();

  const salaryId = String(formData.get("salaryId") ?? "");
  const salary = await prisma.salary.findUnique({ where: { id: salaryId } });
  if (!salary || salary.status !== "APPROVED") return;
  if (salary.month.getTime() !== monthStart(new Date()).getTime()) return;

  await prisma.salary.update({
    where: { id: salaryId },
    data: { status: "DRAFT", approvedBy: null },
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
    advancesTotal: salary.advancesTotal,
    finesTotal: salary.finesTotal,
  });
  await prisma.salary.update({ where: { id: salaryId }, data: { bonus, netPay } });

  revalidatePath("/accountant/payroll");
}
