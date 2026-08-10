import { prisma } from "@/lib/prisma";
import type { Point } from "@prisma/client";

export type PendingHandoverRow = {
  id: string;
  handoverDate: Date;
  amount: number;
  dispatcherName: string;
};

export type PointCashSummary = {
  point: Point;
  pending: PendingHandoverRow[];
  balance: number;
};

export type OwnerPayoutState = { error: string };

/**
 * Deliberately not scoped to a period/date — unlike the report page's own
 * date picker, this is a running all-time cash-on-hand balance (confirmed
 * CashHandover total minus OwnerPayout total, per point), so switching the
 * date picker must not change it.
 */
export async function getAccountantCashSummary(): Promise<PointCashSummary[]> {
  const [pending, confirmedAgg, payoutAgg] = await Promise.all([
    prisma.cashHandover.findMany({
      where: { accountantConfirmedAt: null },
      orderBy: { handoverDate: "asc" },
      include: { dispatcherConfirmedByUser: true },
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
  }));
}

/** Lightweight count for the accountant nav badge — kept separate from
 * getAccountantCashSummary so every accountant-section page navigation
 * (which re-runs the layout) doesn't pay for the full balance computation. */
export async function getPendingCashHandoverCount(): Promise<number> {
  return prisma.cashHandover.count({ where: { accountantConfirmedAt: null } });
}
