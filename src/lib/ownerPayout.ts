import { prisma } from "@/lib/prisma";
import { monthStart, monthEnd } from "@/lib/month";
import { uzMonthName } from "@/lib/format";
import type { Point } from "@prisma/client";

export type PendingHandoverRow = {
  id: string;
  handoverDate: Date;
  amount: number;
  dispatcherName: string;
  /** Only set when the dispatcher overrode the auto-computed amount —
   * shown to the accountant so they know why it differs before confirming. */
  note: string | null;
};

export type PointPending = {
  point: Point;
  pending: PendingHandoverRow[];
};

export type ConfirmedHandoverRow = {
  id: string;
  handoverDate: Date;
  amount: number;
  point: Point;
  dispatcherName: string;
  accountantName: string;
  /** Only set when the dispatcher overrode the auto-computed amount. */
  note: string | null;
};

export type OwnerPayoutRow = {
  id: string;
  payoutDate: Date;
  amount: number;
  note: string | null;
  enteredByName: string;
};

export type CashLedgerSummary = {
  pointPending: PointPending[];
  /** Confirmed cash on hand, all expenses paid out of that same physical
   * cash already deducted (see computeCashBalance) — a single company-wide
   * figure, not split by point, since most of what it's spent on (salary,
   * repairs, fuel-station bills, ...) isn't point-attributable. */
  balance: number;
  /** null until the accountant sets one — see computeCashBalance for why
   * this matters (without it, the balance is meaningless). */
  openingBalance: { amount: number; setDate: Date } | null;
  confirmedHistory: ConfirmedHandoverRow[];
  payoutHistory: OwnerPayoutRow[];
};

export type OwnerPayoutState = { error: string };

// Both history lists are capped — this is a running log that only grows,
// and the dashboard isn't the place for a full unbounded ledger. Most
// recent first.
const HISTORY_LIMIT = 15;

async function getLatestOpeningBalance(): Promise<{ amount: number; setDate: Date } | null> {
  const row = await prisma.cashOpeningBalance.findFirst({ orderBy: { setDate: "desc" } });
  return row ? { amount: Number(row.amount), setDate: row.setDate } : null;
}

/**
 * The company's actual cash-on-hand: starting from the accountant's last
 * physical cash count (CashOpeningBalance — see its schema comment for
 * why this exists), everything dispatchers have handed over and the
 * accountant confirmed SINCE THEN, minus everything physically paid out
 * of that same cash pile since then — owner payouts, and every real
 * expense the business pays in cash. Without an opening balance, this
 * would sum ALL historical expenses (months of them) against a
 * CashHandover tracker that only started accruing a few days ago,
 * producing a deeply negative, meaningless number — so until one is set,
 * this returns 0 rather than that misleading figure.
 *
 * Vehicle fuel is deliberately excluded from the generic Expense sum:
 * FuelLog records an Expense the moment fuel is taken on credit from the
 * station, not when cash actually changes hands — that only happens later
 * via StationPayment, so counting both would double-subtract the same
 * fuel cost. A driver's advance plus their eventually-paid net pay (which
 * already nets the advance back out — see computeNetPay) together equal
 * the real cash paid to that employee for the month, so summing both here
 * doesn't double-count either.
 */
async function computeCashBalance(opening?: { amount: number; setDate: Date } | null): Promise<number> {
  const openingBalance = opening === undefined ? await getLatestOpeningBalance() : opening;
  if (!openingBalance) return 0;
  const since = openingBalance.setDate;

  const [confirmedAgg, payoutAgg, expenseAgg, lunchAgg, staffExpenseAgg, advanceAgg, salaryAgg, stationPaymentAgg] =
    await Promise.all([
      prisma.cashHandover.aggregate({ _sum: { amount: true }, where: { accountantConfirmedAt: { gte: since } } }),
      prisma.ownerPayout.aggregate({ _sum: { amount: true }, where: { payoutDate: { gte: since } } }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { category: { not: "FUEL" }, expenseDate: { gte: since } },
      }),
      prisma.lunch.aggregate({ _sum: { amount: true }, where: { lunchDate: { gte: since } } }),
      prisma.staffExpense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: since } } }),
      prisma.advance.aggregate({ _sum: { amount: true }, where: { givenDate: { gte: since } } }),
      // Filtered on paidAt (the exact moment "Ойлик берилди" was clicked per
      // employee), not month (always the 1st of the calendar month) — the
      // latter let this-month payroll paid out after the opening balance was
      // set (i.e. basically always) go uncounted, since month-start < since.
      prisma.salary.aggregate({ _sum: { netPay: true }, where: { status: "PAID", paidAt: { gte: since } } }),
      // StationPayment has no per-installment date, only paidAt (set once
      // the bill is FULLY paid) — a bill partially paid after `since` but
      // not yet fully settled won't be counted until it is. No better
      // field exists on this model to do better than that approximation.
      prisma.stationPayment.aggregate({ _sum: { paidAmount: true }, where: { paidAt: { gte: since } } }),
    ]);

  const confirmed = Number(confirmedAgg._sum.amount ?? BigInt(0));
  const paidToOwner = Number(payoutAgg._sum.amount ?? BigInt(0));
  const expenses = Number(expenseAgg._sum.amount ?? BigInt(0));
  const lunch = Number(lunchAgg._sum.amount ?? BigInt(0));
  const staffExpenses = Number(staffExpenseAgg._sum.amount ?? BigInt(0));
  const advances = Number(advanceAgg._sum.amount ?? BigInt(0));
  const salaries = Number(salaryAgg._sum.netPay ?? BigInt(0));
  const stationPayments = Number(stationPaymentAgg._sum.paidAmount ?? BigInt(0));

  return (
    openingBalance.amount +
    confirmed -
    paidToOwner -
    expenses -
    lunch -
    staffExpenses -
    advances -
    salaries -
    stationPayments
  );
}

export async function getCashBalance(): Promise<number> {
  return computeCashBalance();
}

/**
 * Deliberately not scoped to a period/date — unlike the report page's own
 * date picker, this is a running all-time cash-on-hand balance, so
 * switching the date picker must not change it.
 */
export async function getCashLedgerSummary(): Promise<CashLedgerSummary> {
  const openingBalance = await getLatestOpeningBalance();

  const [pending, confirmed, payouts, balance] = await Promise.all([
    prisma.cashHandover.findMany({
      where: { accountantConfirmedAt: null },
      orderBy: { handoverDate: "asc" },
      include: { dispatcherConfirmedByUser: true },
    }),
    prisma.cashHandover.findMany({
      where: { accountantConfirmedAt: { not: null } },
      orderBy: { handoverDate: "desc" },
      take: HISTORY_LIMIT,
      include: { dispatcherConfirmedByUser: true, accountantConfirmedByUser: true },
    }),
    prisma.ownerPayout.findMany({
      orderBy: { payoutDate: "desc" },
      take: HISTORY_LIMIT,
      include: { enteredByUser: true },
    }),
    computeCashBalance(openingBalance),
  ]);

  const pointPending: PointPending[] = (["FARGONA", "QUVA"] as const).map((point) => ({
    point,
    pending: pending
      .filter((h) => h.point === point)
      .map((h) => ({
        id: h.id,
        handoverDate: h.handoverDate,
        amount: Number(h.amount),
        dispatcherName: h.dispatcherConfirmedByUser.fullName,
        note: h.note,
      })),
  }));

  return {
    pointPending,
    balance,
    openingBalance,
    confirmedHistory: confirmed.map((h) => ({
      id: h.id,
      handoverDate: h.handoverDate,
      amount: Number(h.amount),
      point: h.point,
      dispatcherName: h.dispatcherConfirmedByUser.fullName,
      accountantName: h.accountantConfirmedByUser?.fullName ?? "—",
      note: h.note,
    })),
    payoutHistory: payouts.map((p) => ({
      id: p.id,
      payoutDate: p.payoutDate,
      amount: Number(p.amount),
      note: p.note,
      enteredByName: p.enteredByUser.fullName,
    })),
  };
}

/** Lightweight count for the accountant nav badge — kept separate from
 * getCashLedgerSummary so every accountant-section page navigation (which
 * re-runs the layout) doesn't pay for the full ledger computation. */
export async function getPendingCashHandoverCount(): Promise<number> {
  return prisma.cashHandover.count({ where: { accountantConfirmedAt: null } });
}

export type MonthlyPayoutPoint = { label: string; amount: number };

/** For the Owner's dashboard — how much they've actually received, month by
 * month. Read-only (no confirm/payout actions for Owner, that's the
 * accountant's job); this is purely visibility into money already paid. */
export async function getOwnerPayoutTrend(monthsBack = 6): Promise<MonthlyPayoutPoint[]> {
  const now = new Date();
  const currentMonthStart = monthStart(now);
  const rangeFrom = new Date(
    Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - (monthsBack - 1), 1)
  );

  const payouts = await prisma.ownerPayout.findMany({
    where: { payoutDate: { gte: rangeFrom } },
    select: { payoutDate: true, amount: true },
  });

  const monthIndex = (date: Date) =>
    (date.getUTCFullYear() - rangeFrom.getUTCFullYear()) * 12 + (date.getUTCMonth() - rangeFrom.getUTCMonth());

  const amounts = new Array(monthsBack).fill(0);
  for (const p of payouts) {
    const i = monthIndex(p.payoutDate);
    if (i >= 0 && i < monthsBack) amounts[i] += Number(p.amount);
  }

  return amounts.map((amount, i) => {
    const d = new Date(Date.UTC(rangeFrom.getUTCFullYear(), rangeFrom.getUTCMonth() + i, 1));
    return { label: uzMonthName(d), amount };
  });
}

export async function getOwnerPayoutMonthSummary(): Promise<{ thisMonth: number; lastMonth: number }> {
  const now = new Date();
  const thisStart = monthStart(now);
  const thisEnd = monthEnd(now);
  const lastMonthDate = new Date(Date.UTC(thisStart.getUTCFullYear(), thisStart.getUTCMonth() - 1, 1));
  const lastStart = monthStart(lastMonthDate);
  const lastEnd = monthEnd(lastMonthDate);

  const [thisAgg, lastAgg] = await Promise.all([
    prisma.ownerPayout.aggregate({ _sum: { amount: true }, where: { payoutDate: { gte: thisStart, lte: thisEnd } } }),
    prisma.ownerPayout.aggregate({ _sum: { amount: true }, where: { payoutDate: { gte: lastStart, lte: lastEnd } } }),
  ]);

  return {
    thisMonth: Number(thisAgg._sum.amount ?? BigInt(0)),
    lastMonth: Number(lastAgg._sum.amount ?? BigInt(0)),
  };
}
