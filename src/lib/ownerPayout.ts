import { prisma } from "@/lib/prisma";
import type { Point } from "@prisma/client";

export type PendingHandoverRow = {
  id: string;
  handoverDate: Date;
  amount: number;
  dispatcherName: string;
};

export type ConfirmedHandoverRow = {
  id: string;
  handoverDate: Date;
  amount: number;
  dispatcherName: string;
  accountantName: string;
};

export type OwnerPayoutRow = {
  id: string;
  payoutDate: Date;
  amount: number;
  note: string | null;
  enteredByName: string;
};

export type PointCashSummary = {
  point: Point;
  pending: PendingHandoverRow[];
  balance: number;
  confirmedHistory: ConfirmedHandoverRow[];
  payoutHistory: OwnerPayoutRow[];
};

export type OwnerPayoutState = { error: string };

// Both history lists are capped — this is a running log that only grows,
// and the point card isn't the place for a full unbounded ledger. Most
// recent first.
const HISTORY_LIMIT = 15;

/**
 * Deliberately not scoped to a period/date — unlike the report page's own
 * date picker, this is a running all-time cash-on-hand balance (confirmed
 * CashHandover total minus OwnerPayout total, per point), so switching the
 * date picker must not change it.
 */
export async function getAccountantCashSummary(): Promise<PointCashSummary[]> {
  const [pending, confirmed, payouts, confirmedAgg, payoutAgg] = await Promise.all([
    prisma.cashHandover.findMany({
      where: { accountantConfirmedAt: null },
      orderBy: { handoverDate: "asc" },
      include: { dispatcherConfirmedByUser: true },
    }),
    prisma.cashHandover.findMany({
      where: { accountantConfirmedAt: { not: null } },
      orderBy: { handoverDate: "desc" },
      include: { dispatcherConfirmedByUser: true, accountantConfirmedByUser: true },
    }),
    prisma.ownerPayout.findMany({
      orderBy: { payoutDate: "desc" },
      include: { enteredByUser: true },
    }),
    prisma.cashHandover.groupBy({
      by: ["point"],
      where: { accountantConfirmedAt: { not: null } },
      _sum: { amount: true },
    }),
    prisma.ownerPayout.groupBy({ by: ["point"], _sum: { amount: true } }),
  ]);

  const confirmedByPoint = new Map(confirmedAgg.map((r) => [r.point, Number(r._sum.amount ?? BigInt(0))]));
  const paidByPoint = new Map(payoutAgg.map((r) => [r.point, Number(r._sum.amount ?? BigInt(0))]));

  return (["FARGONA", "QUVA"] as const).map((point) => ({
    point,
    pending: pending
      .filter((h) => h.point === point)
      .map((h) => ({
        id: h.id,
        handoverDate: h.handoverDate,
        amount: Number(h.amount),
        dispatcherName: h.dispatcherConfirmedByUser.fullName,
      })),
    balance: (confirmedByPoint.get(point) ?? 0) - (paidByPoint.get(point) ?? 0),
    confirmedHistory: confirmed
      .filter((h) => h.point === point)
      .slice(0, HISTORY_LIMIT)
      .map((h) => ({
        id: h.id,
        handoverDate: h.handoverDate,
        amount: Number(h.amount),
        dispatcherName: h.dispatcherConfirmedByUser.fullName,
        accountantName: h.accountantConfirmedByUser?.fullName ?? "—",
      })),
    payoutHistory: payouts
      .filter((p) => p.point === point)
      .slice(0, HISTORY_LIMIT)
      .map((p) => ({
        id: p.id,
        payoutDate: p.payoutDate,
        amount: Number(p.amount),
        note: p.note,
        enteredByName: p.enteredByUser.fullName,
      })),
  }));
}

/** Lightweight count for the accountant nav badge — kept separate from
 * getAccountantCashSummary so every accountant-section page navigation
 * (which re-runs the layout) doesn't pay for the full balance computation. */
export async function getPendingCashHandoverCount(): Promise<number> {
  return prisma.cashHandover.count({ where: { accountantConfirmedAt: null } });
}
