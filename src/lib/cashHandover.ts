import { prisma } from "@/lib/prisma";
import type { Point } from "@prisma/client";

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// dispatcherId is mandatory, not optional: once more than one dispatcher can
// hand over the same point/day (see CashHandover's widened unique key),
// computeCashBalance/computeBalanceLedger must recompute each CashHandover
// row's own dispatcher's figure specifically — looking up a pooled,
// all-dispatchers value here would silently double-count the balance the
// moment two handovers exist for the same point/day (exactly the case this
// whole mechanism exists to support).
function dayKey(point: string, date: Date, dispatcherId: string): string {
  return `${point}|${utcDayStart(date).getTime()}|${dispatcherId}`;
}

/** Looks up one point/day/dispatcher's entry in a computeDailyCashAmounts
 * map — the key format is this module's own private detail, so callers go
 * through this instead of building the key string themselves. */
export function getDailyCashAmount(map: Map<string, bigint>, point: string, date: Date, dispatcherId: string): bigint | undefined {
  return map.get(dayKey(point, date, dispatcherId));
}

/** Sums every contributor's entry for a point/day — the pooled figure this
 * whole per-dispatcher scheme replaces. Kept only as a fallback for
 * handovers created before PER_DISPATCHER_HANDOVER_CUTOFF (see its own
 * comment); nothing new should read this directly. */
function getDailyCashAmountPooled(map: Map<string, bigint>, point: string, date: Date): bigint {
  const prefix = `${point}|${utcDayStart(date).getTime()}|`;
  let sum = BigInt(0);
  for (const [k, v] of map) if (k.startsWith(prefix)) sum += v;
  return sum;
}

/** Handovers created before this were submitted under the old system,
 * where exactly one handover could exist per (point, day) — so the
 * dispatcher who happened to click "Топшираман" could be physically
 * handing over cash a colleague collected too (shift rotation), before
 * per-dispatcher splitting existed at all. Recomputing those rows live
 * with the new per-dispatcher scoping would attribute only *that*
 * dispatcher's own share to a row the accountant already confirmed in
 * full, silently understating the balance by whatever a second
 * contributor's share was that day — a real case, caught by cross-
 * checking real production data (a QUVA/2026-09-05 handover: one
 * dispatcher's own share was 5,588,000, but the accountant had already
 * confirmed the full 8,448,000 two dispatchers together actually
 * collected). Rows created on/after this date were always meant to be
 * scoped per dispatcher from the start, so no such ambiguity exists for
 * them — see getLiveHandoverAmount, the only place this is read. */
export const PER_DISPATCHER_HANDOVER_CUTOFF = new Date("2026-09-05T19:45:00.000Z");

/** The correct live-recompute for one CashHandover row: per-dispatcher for
 * rows created on/after PER_DISPATCHER_HANDOVER_CUTOFF, pooled (summed
 * across every contributor that point/day) for older rows — see the
 * cutoff's own comment for why. ownerPayout.ts's three call sites already
 * have a row's point/handoverDate/dispatcherConfirmedBy/createdAt from
 * their own query, so this just centralizes the branch in one place. */
export function getLiveHandoverAmount(
  map: Map<string, bigint>,
  handover: { point: Point; handoverDate: Date; dispatcherConfirmedBy: string; createdAt: Date }
): bigint | undefined {
  if (handover.createdAt >= PER_DISPATCHER_HANDOVER_CUTOFF) {
    return getDailyCashAmount(map, handover.point, handover.handoverDate, handover.dispatcherConfirmedBy);
  }
  return getDailyCashAmountPooled(map, handover.point, handover.handoverDate);
}

/**
 * Every dispatcher's own real collectible cash for every calendar day in
 * [since, until]: that dispatcher's own trip + other-income revenue for a
 * point/day, minus that same dispatcher's own staff-expense + lunch
 * spending there (their own point-level costs, already paid out of the
 * same physical cash pile they're personally holding before handing
 * anything over) — the same formula createHandoverForDate
 * (dispatcher/actions.ts) freezes into CashHandover.amount once, at
 * submission time, now scoped per dispatcher (see the client's own
 * requirement: dispatchers rotate shifts at the same point on the same
 * day, and each is responsible only for what passed through their own
 * hands — confirmed expenses/lunch should split the same way as income).
 *
 * That freeze goes stale the moment a trip/expense for an already-
 * submitted day is edited or deleted afterward (a real production case:
 * a trip's revenue was corrected after that day's handover had already
 * been submitted and confirmed, leaving the accountant physically holding
 * 50,000 so'm more than the frozen figures accounted for anywhere). Rather
 * than trust the frozen column, every reader that needs "this dispatcher's
 * cash for this point/day right now" should call this instead and only
 * fall back to the frozen amount/confirmedAmount when this fails to
 * explain a genuine physical adjustment (see confirmedAmount's own doc
 * comment — that one IS meant to freeze, since it records a real physical
 * count, not a log of trips/expenses that can still be corrected).
 *
 * Batches this across the whole range in 4 queries total (not 4 per day
 * or 4 per dispatcher), since a page like /accountant/report can have
 * dozens of days' (and now, several dispatchers') worth of confirmed
 * handovers to recompute at once — grouping by enteredBy from the start
 * means one pass over the range serves every dispatcher's own figure with
 * no N+1.
 */
export async function computeDailyCashAmounts(since: Date, until: Date): Promise<Map<string, bigint>> {
  const [trips, otherIncomes, staffExpenses, lunches] = await Promise.all([
    prisma.trip.findMany({
      where: { tripDate: { gte: since, lte: until }, point: { in: ["FARGONA", "QUVA"] } },
      select: { point: true, tripDate: true, revenue: true, enteredBy: true },
    }),
    prisma.otherIncome.findMany({
      where: { point: { in: ["FARGONA", "QUVA"] }, incomeDate: { gte: since, lte: until } },
      select: { point: true, incomeDate: true, amount: true, enteredBy: true },
    }),
    prisma.staffExpense.findMany({
      where: { point: { in: ["FARGONA", "QUVA"] }, expenseDate: { gte: since, lte: until } },
      select: { point: true, expenseDate: true, amount: true, enteredBy: true },
    }),
    // enteredBy, not userId: userId is who the lunch is FOR (a dispatcher
    // can log lunch for a driver), enteredBy is who actually recorded/paid
    // it out of their own point-level cash — the latter is what determines
    // whose handover this expense comes off of.
    prisma.lunch.findMany({
      where: { point: { in: ["FARGONA", "QUVA"] }, lunchDate: { gte: since, lte: until } },
      select: { point: true, lunchDate: true, amount: true, enteredBy: true },
    }),
  ]);

  const map = new Map<string, bigint>();
  const add = (k: string, delta: bigint) => map.set(k, (map.get(k) ?? BigInt(0)) + delta);

  for (const t of trips) add(dayKey(t.point, t.tripDate, t.enteredBy), t.revenue);
  for (const i of otherIncomes) add(dayKey(i.point, i.incomeDate, i.enteredBy), i.amount);
  for (const e of staffExpenses) add(dayKey(e.point, e.expenseDate, e.enteredBy), -e.amount);
  for (const l of lunches) add(dayKey(l.point, l.lunchDate, l.enteredBy), -l.amount);

  // Same floor as createHandoverForDate, now applied per dispatcher: one
  // dispatcher's point-level costs outrunning their own collections that
  // day just means nothing for THEM to hand over, not a debt — and it's no
  // longer rescued by a colleague's collections at the same point/day.
  for (const [k, v] of map) if (v < BigInt(0)) map.set(k, BigInt(0));
  return map;
}

/** Single-day/point/dispatcher convenience wrapper — for the common case
 * (a dispatcher's own /dispatcher/point page, or creating their own
 * handover) that only ever needs one value rather than a whole range's
 * worth. */
export async function computeDailyCashAmount(point: Point, day: Date, dispatcherId: string): Promise<bigint> {
  const dayStart = utcDayStart(day);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  const map = await computeDailyCashAmounts(dayStart, dayEnd);
  return getDailyCashAmount(map, point, dayStart, dispatcherId) ?? BigInt(0);
}

export type PointDayContribution = { dispatcherId: string; dispatcherName: string; amount: bigint };

/** Every dispatcher who had any trip/income/expense/lunch activity at this
 * point on this day, with their own net collectible amount — the "who
 * collected/owes what today" panel on /dispatcher/point and the
 * per-dispatcher breakdown next to "Бухгалтерга топшириладиган қолдиқ" on
 * the owner/admin/accountant dashboards (FleetDashboard). Reuses the same
 * per-dispatcher map computeDailyCashAmount is built on, so this always
 * agrees with what each dispatcher's own handover would compute. */
export async function getPointDayContributions(point: Point, day: Date): Promise<PointDayContribution[]> {
  const dayStart = utcDayStart(day);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  const map = await computeDailyCashAmounts(dayStart, dayEnd);

  const prefix = `${point}|${dayStart.getTime()}|`;
  const entries = [...map.entries()]
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, amount]) => ({ dispatcherId: k.slice(prefix.length), amount }));
  if (entries.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: entries.map((e) => e.dispatcherId) } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  return entries.map((e) => ({ ...e, dispatcherName: nameById.get(e.dispatcherId) ?? "—" }));
}

export type PointContributionRow = { dispatcherId: string; dispatcherName: string; amount: number; submitted: boolean };

/** Both points' contributions for one day, each row also saying whether
 * that dispatcher has already submitted their own handover — the data
 * behind FleetDashboard's per-point "who collected/owes what today"
 * breakdown (owner/admin/accountant dashboards). Computes the underlying
 * per-dispatcher map once and slices both points out of it, rather than
 * calling getPointDayContributions twice (which would redo the same
 * 4-query batch for FARGONA and QUVA separately). */
export async function getPointContributionsForDay(day: Date): Promise<Record<"FARGONA" | "QUVA", PointContributionRow[]>> {
  const dayStart = utcDayStart(day);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  const [map, handoversToday] = await Promise.all([
    computeDailyCashAmounts(dayStart, dayEnd),
    prisma.cashHandover.findMany({
      where: { handoverDate: dayStart, point: { in: ["FARGONA", "QUVA"] } },
      select: { point: true, dispatcherConfirmedBy: true },
    }),
  ]);
  const submittedSet = new Set(handoversToday.map((h) => `${h.point}|${h.dispatcherConfirmedBy}`));

  const byPoint: Record<"FARGONA" | "QUVA", { dispatcherId: string; amount: bigint }[]> = { FARGONA: [], QUVA: [] };
  for (const [key, amount] of map) {
    const [point, , dispatcherId] = key.split("|");
    if (point === "FARGONA" || point === "QUVA") byPoint[point].push({ dispatcherId, amount });
  }

  const allDispatcherIds = [...byPoint.FARGONA, ...byPoint.QUVA].map((e) => e.dispatcherId);
  const users = allDispatcherIds.length
    ? await prisma.user.findMany({ where: { id: { in: allDispatcherIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  const toRows = (point: "FARGONA" | "QUVA"): PointContributionRow[] =>
    byPoint[point].map((e) => ({
      dispatcherId: e.dispatcherId,
      dispatcherName: nameById.get(e.dispatcherId) ?? "—",
      amount: Number(e.amount),
      submitted: submittedSet.has(`${point}|${e.dispatcherId}`),
    }));

  return { FARGONA: toRows("FARGONA"), QUVA: toRows("QUVA") };
}

export type DailyCashBreakdown = { collected: bigint; spent: bigint; net: bigint };

/** The "Йиғилди X − расход Y = Z" line on /dispatcher/point, scoped to one
 * dispatcher — a small, direct aggregate (not routed through
 * computeDailyCashAmounts) since it's always exactly one point/day/
 * dispatcher at a time, unlike that function's whole-range batching.
 * Deliberately duplicates computeDailyCashAmount's collected-minus-spent
 * formula for this narrower shape (collected and spent as separate
 * figures, not just the net) — the same accepted trade-off
 * computeCashDetail's own doc comment makes for a different-shaped
 * consumer of the same underlying rule. */
export async function computeDailyCashBreakdown(point: Point, day: Date, dispatcherId: string): Promise<DailyCashBreakdown> {
  const dayStart = utcDayStart(day);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  const scope = { point, enteredBy: dispatcherId } as const;

  const [tripAgg, otherIncomeAgg, staffExpenseAgg, lunchAgg] = await Promise.all([
    prisma.trip.aggregate({ _sum: { revenue: true }, where: { ...scope, tripDate: { gte: dayStart, lte: dayEnd } } }),
    prisma.otherIncome.aggregate({ _sum: { amount: true }, where: { ...scope, incomeDate: { gte: dayStart, lte: dayEnd } } }),
    prisma.staffExpense.aggregate({ _sum: { amount: true }, where: { ...scope, expenseDate: { gte: dayStart, lte: dayEnd } } }),
    // enteredBy, not userId — see computeDailyCashAmounts's own comment.
    prisma.lunch.aggregate({ _sum: { amount: true }, where: { ...scope, lunchDate: { gte: dayStart, lte: dayEnd } } }),
  ]);

  const collected = (tripAgg._sum.revenue ?? BigInt(0)) + (otherIncomeAgg._sum.amount ?? BigInt(0));
  const spent = (staffExpenseAgg._sum.amount ?? BigInt(0)) + (lunchAgg._sum.amount ?? BigInt(0));
  const net = collected - spent;
  return { collected, spent, net: net < BigInt(0) ? BigInt(0) : net };
}
