import { prisma } from "@/lib/prisma";
import type { Point } from "@prisma/client";

function dayKey(point: string, date: Date): string {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return `${point}|${day}`;
}

/** Looks up one point/day's entry in a computeDailyCashAmounts map — the
 * key format is this module's own private detail, so callers go through
 * this instead of building the key string themselves. */
export function getDailyCashAmount(map: Map<string, bigint>, point: string, date: Date): bigint | undefined {
  return map.get(dayKey(point, date));
}

/**
 * A point's real collectible cash for every calendar day in [since, until]:
 * that day's trip + other-income revenue, minus that day's own staff-
 * expense + lunch spending (a dispatcher's own point-level costs, already
 * paid out of the same cash pile before physically handing anything over)
 * — the same formula createHandoverForDate (dispatcher/actions.ts) freezes
 * into CashHandover.amount once, at submission time.
 *
 * That freeze goes stale the moment a trip/expense for an already-
 * submitted day is edited or deleted afterward (a real production case:
 * a trip's revenue was corrected after that day's handover had already
 * been submitted and confirmed, leaving the accountant physically holding
 * 50,000 so'm more than the frozen figures accounted for anywhere). Rather
 * than trust the frozen column, every reader that needs "the point's cash
 * for this day right now" should call this instead and only fall back to
 * the frozen amount/confirmedAmount when this fails to explain a genuine
 * physical adjustment (see confirmedAmount's own doc comment — that one
 * IS meant to freeze, since it records a real physical count, not a log
 * of trips/expenses that can still be corrected).
 *
 * Batches this across the whole range in 4 queries total (not 4 per day),
 * since a page like /accountant/report can have dozens of days' worth of
 * confirmed handovers to recompute at once.
 */
export async function computeDailyCashAmounts(since: Date, until: Date): Promise<Map<string, bigint>> {
  const [trips, otherIncomes, staffExpenses, lunches] = await Promise.all([
    prisma.trip.findMany({
      where: { tripDate: { gte: since, lte: until }, point: { in: ["FARGONA", "QUVA"] } },
      select: { point: true, tripDate: true, revenue: true },
    }),
    prisma.otherIncome.findMany({
      where: { point: { in: ["FARGONA", "QUVA"] }, incomeDate: { gte: since, lte: until } },
      select: { point: true, incomeDate: true, amount: true },
    }),
    prisma.staffExpense.findMany({
      where: { point: { in: ["FARGONA", "QUVA"] }, expenseDate: { gte: since, lte: until } },
      select: { point: true, expenseDate: true, amount: true },
    }),
    prisma.lunch.findMany({
      where: { point: { in: ["FARGONA", "QUVA"] }, lunchDate: { gte: since, lte: until } },
      select: { point: true, lunchDate: true, amount: true },
    }),
  ]);

  const map = new Map<string, bigint>();
  const add = (k: string, delta: bigint) => map.set(k, (map.get(k) ?? BigInt(0)) + delta);

  for (const t of trips) add(dayKey(t.point, t.tripDate), t.revenue);
  for (const i of otherIncomes) add(dayKey(i.point, i.incomeDate), i.amount);
  for (const e of staffExpenses) add(dayKey(e.point, e.expenseDate), -e.amount);
  for (const l of lunches) add(dayKey(l.point, l.lunchDate), -l.amount);

  // Same floor as createHandoverForDate: a dispatcher never hands over a
  // negative amount, a day whose point-level costs outran its collections
  // that day just means nothing to hand over, not a debt.
  for (const [k, v] of map) if (v < BigInt(0)) map.set(k, BigInt(0));
  return map;
}

/** Single-day/point convenience wrapper — for the one place (a dispatcher's
 * own /dispatcher/point page, viewing one specific day) that only ever
 * needs one value rather than a whole range's worth. */
export async function computeDailyCashAmount(point: Point, day: Date): Promise<bigint> {
  const tomorrow = new Date(day.getTime() + 86_400_000);
  const map = await computeDailyCashAmounts(day, new Date(tomorrow.getTime() - 1));
  return map.get(dayKey(point, day)) ?? BigInt(0);
}
