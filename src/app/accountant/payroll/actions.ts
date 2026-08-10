"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNetPay } from "@/lib/payroll";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";
import { computeDriverMonthlyPay } from "@/lib/driverPay";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseMonth(value: string): Date | null {
  if (!MONTH_RE.test(value)) return null;
  const [y, m] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

async function requireAccountant() {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    throw new Error("Рухсат йўқ");
  }
  return session.user.id;
}

/** Only the current, still-open month is editable — a past month's payout
 * is already settled, so reopening it is a payroll-integrity risk. */
function requireCurrentMonth(month: Date | null): month is Date {
  return !!month && month.getTime() === monthStart(new Date()).getTime();
}

/** A PAID row is settled — cash already left against its frozen figures, so
 * nothing (including a fresh advance/fine) may attach to it retroactively;
 * anything given to that employee after they were paid belongs to next
 * month's payroll instead. */
async function isSalaryPaid(userId: string, month: Date): Promise<boolean> {
  const salary = await prisma.salary.findUnique({ where: { userId_month: { userId, month } } });
  return salary?.status === "PAID";
}

// Recomputes a user's Salary row from scratch (live driver trip revenue or
// flat rate, live advance/fine totals, and either the existing or a new
// bonus) and upserts it — used by every edit action below so touching any
// one field always leaves the whole row internally consistent. Any edit
// also un-freezes an already-approved row back to DRAFT, since the figures
// it was approved on no longer hold — replaces the old separate "revert to
// draft" button with an automatic, per-edit version of the same thing.
async function recomputeAndUpsertSalary(userId: string, month: Date, bonusOverride?: bigint) {
  const from = month;
  const to = monthEnd(month);

  const [user, driver, finesAgg, advancesAgg, existing] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.driver.findUnique({ where: { userId } }),
    prisma.fine.aggregate({
      _sum: { amount: true },
      where: { userId, deducted: true, fineDate: { gte: from, lte: to } },
    }),
    prisma.advance.aggregate({ _sum: { amount: true }, where: { userId, month } }),
    prisma.salary.findUnique({ where: { userId_month: { userId, month } } }),
  ]);

  // Once cash has actually been handed over (PAID), the row is settled —
  // editing it further would silently change the figures the cash-balance
  // formula already subtracted against, with nothing left to re-subtract.
  if (existing?.status === "PAID") return;

  let baseSalary = user.baseSalary ?? BigInt(0);
  if (driver) {
    baseSalary = (await computeDriverMonthlyPay(driver.id, from, to)).total;
  }

  const bonus = bonusOverride ?? existing?.bonus ?? BigInt(0);
  const finesTotal = finesAgg._sum.amount ?? BigInt(0);
  const advancesTotal = advancesAgg._sum.amount ?? BigInt(0);
  const netPay = computeNetPay({ baseSalary, bonus, advancesTotal, finesTotal });

  await prisma.salary.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, baseSalary, bonus, advancesTotal, finesTotal, netPay, status: "DRAFT" },
    update: { baseSalary, bonus, advancesTotal, finesTotal, netPay, status: "DRAFT", approvedBy: null },
  });
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

    // A PAID row is settled — cash already left against its frozen netPay,
    // so it must never be touched again (unlike APPROVED, which still gets
    // a live driver-pay refresh below).
    if (existing?.status === "PAID") continue;

    if (existing && existing.status !== "DRAFT") {
      // Approval only freezes the accountant-entered figures (advance/fine/
      // bonus) — a driver's base salary keeps accruing trip-by-trip all
      // month, so it's refreshed here too rather than staying stuck at
      // whatever it was the moment "Тасдиқлаш" happened to be clicked.
      if (user.role === "DRIVER") {
        const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
        if (driver) {
          const baseSalary = (await computeDriverMonthlyPay(driver.id, from, to)).total;
          const netPay = computeNetPay({
            baseSalary,
            bonus: existing.bonus,
            advancesTotal: existing.advancesTotal,
            finesTotal: existing.finesTotal,
          });
          await prisma.salary.update({ where: { id: existing.id }, data: { baseSalary, netPay } });
        }
      }
      continue;
    }

    const [finesAgg, advancesAgg, driver] = await Promise.all([
      prisma.fine.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, deducted: true, fineDate: { gte: from, lte: to } },
      }),
      prisma.advance.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, month },
      }),
      user.role === "DRIVER" ? prisma.driver.findUnique({ where: { userId: user.id } }) : Promise.resolve(null),
    ]);

    // A driver's base salary is now entirely computed from their daily trip
    // revenue (see driverPay.ts) instead of the flat, admin-set rate — a
    // day with no trips (sick leave, handed off to a spare driver) simply
    // earns nothing, so a mid-month swap naturally splits pay correctly.
    // Non-driver roles keep the flat rate.
    let baseSalary = user.baseSalary ?? BigInt(0);
    if (driver) {
      baseSalary = (await computeDriverMonthlyPay(driver.id, from, to)).total;
    }

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

/** Marks one employee's already-approved salary as actually handed over —
 * separate from approvePayrollAction because employees aren't all paid in
 * the same instant. paidAt is what the cash-balance formula (ownerPayout.ts)
 * subtracts against, so it must be the real moment cash left, not the whole
 * month's approval timestamp. Only APPROVED rows can be marked paid: editing
 * a row (setMaoshAction/setBonusAction/etc.) resets it to DRAFT, and once
 * paid a row can no longer be edited at all (see requireCurrentMonth callers
 * in PayrollRow), so this is the last step in the row's lifecycle. */
export async function markSalaryPaidAction(formData: FormData) {
  const paidBy = await requireAccountant();

  const targetUserId = String(formData.get("userId") ?? "");
  const month = parseMonth(String(formData.get("month") ?? ""));
  if (!requireCurrentMonth(month)) return;

  const salary = await prisma.salary.findUnique({ where: { userId_month: { userId: targetUserId, month } } });
  if (!salary || salary.status !== "APPROVED") return;

  await prisma.salary.update({
    where: { id: salary.id },
    data: { status: "PAID", paidAt: new Date(), paidBy },
  });

  revalidatePath("/accountant/payroll");
}

/** Manual override of a non-driver's flat monthly rate — drivers' pay is
 * computed from trip revenue, not hand-set, so this no-ops for them. */
export async function setMaoshAction(formData: FormData) {
  await requireAccountant();

  const userId = String(formData.get("userId") ?? "");
  const month = parseMonth(String(formData.get("month") ?? ""));
  if (!requireCurrentMonth(month)) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "DRIVER") return;

  const rawSalary = Number(formData.get("baseSalary"));
  const baseSalary = BigInt(Number.isFinite(rawSalary) ? Math.max(0, Math.round(rawSalary)) : 0);

  await prisma.user.update({ where: { id: userId }, data: { baseSalary } });
  await recomputeAndUpsertSalary(userId, month);

  revalidatePath("/accountant/payroll");
}

export async function setBonusAction(formData: FormData) {
  await requireAccountant();

  const userId = String(formData.get("userId") ?? "");
  const month = parseMonth(String(formData.get("month") ?? ""));
  if (!requireCurrentMonth(month)) return;

  const rawBonus = Number(formData.get("bonus"));
  const bonus = BigInt(Number.isFinite(rawBonus) ? Math.max(0, Math.round(rawBonus)) : 0);

  await recomputeAndUpsertSalary(userId, month, bonus);

  revalidatePath("/accountant/payroll");
}

export async function addAdvanceAction(formData: FormData) {
  const enteredBy = await requireAccountant();

  const userId = String(formData.get("userId") ?? "");
  const month = parseMonth(String(formData.get("month") ?? ""));
  if (!requireCurrentMonth(month)) return;
  if (await isSalaryPaid(userId, month)) return;

  const rawAmount = Number(formData.get("amount"));
  const amount = BigInt(Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0);
  if (amount <= BigInt(0)) return;

  const dateStr = String(formData.get("date") ?? "");
  const givenDate = DATE_RE.test(dateStr) ? new Date(`${dateStr}T12:00:00Z`) : new Date();

  await prisma.advance.create({ data: { userId, amount, givenDate, month, enteredBy } });
  await recomputeAndUpsertSalary(userId, month);

  revalidatePath("/accountant/payroll");
}

export async function addFineAction(formData: FormData) {
  const enteredBy = await requireAccountant();

  const userId = String(formData.get("userId") ?? "");
  const month = parseMonth(String(formData.get("month") ?? ""));
  if (!requireCurrentMonth(month)) return;
  if (await isSalaryPaid(userId, month)) return;

  const rawAmount = Number(formData.get("amount"));
  const amount = BigInt(Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (amount <= BigInt(0) || !reason) return;

  const dateStr = String(formData.get("date") ?? "");
  const fineDate = DATE_RE.test(dateStr) ? new Date(`${dateStr}T12:00:00Z`) : new Date();

  await prisma.fine.create({ data: { userId, amount, reason, fineDate, deducted: true, enteredBy } });
  await recomputeAndUpsertSalary(userId, month);

  revalidatePath("/accountant/payroll");
}
