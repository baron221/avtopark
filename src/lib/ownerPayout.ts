import { prisma } from "@/lib/prisma";
import { monthStart, monthEnd } from "@/lib/month";
import { uzMonthName, formatDayMonth, formatSom } from "@/lib/format";
import { OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import { rangeForPeriod, type Period } from "@/lib/dashboard";
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
  /** Only set when the accountant's physical count on receipt didn't match
   * `amount` — this, not `amount`, is what actually reached the cash pile
   * (see confirmCashReceiptWithAdjustmentAction). */
  confirmedAmount: number | null;
  confirmedNote: string | null;
};

export type OwnerPayoutRow = {
  id: string;
  payoutDate: Date;
  amount: number;
  note: string | null;
  enteredByName: string;
};

export type TripIncomeDetailRow = {
  id: string;
  time: Date;
  kind: "TRIP" | "ORDER";
  vehiclePlate: string;
  driverName: string;
  amount: number;
  note: string | null;
};

export type OtherIncomeDetailRow = {
  id: string;
  time: Date;
  point: Point;
  category: string;
  amount: number;
  plateNumber: string | null;
  note: string | null;
  enteredByName: string;
};

export type PointExpenseDetailRow = {
  id: string;
  time: Date;
  category: string;
  amount: number;
  personName: string;
  note: string | null;
};

export type OutsideExpenseDetailRow = {
  id: string;
  time: Date;
  /** Vehicle plate for a vehicle Expense, person name for an Advance/Salary
   * payout, station name for a StationPayment — whichever identifies the
   * source, since these come from four different models. */
  subtitle: string;
  category: string;
  amount: number;
  note: string | null;
};

export type CashDetail = {
  /** "Кунлик" / "Ҳафталик" / "Ойлик" — matches the page's own period toggle,
   * so the two tiles' headings ("Умумий {periodWord} тушум/расход") always
   * describe the range they actually cover. */
  periodWord: string;
  /** The concrete range as text — a single date for DAY, "dd.mm – dd.mm"
   * for WEEK, the month name for MONTH. Pre-formatted server-side (see
   * format.ts's comment on why: a "use client" component must not format
   * dates itself in its always-visible markup, or Node/browser ICU
   * differences can break hydration). */
  rangeLabel: string;
  income: {
    total: number;
    fargona: { total: number; rows: TripIncomeDetailRow[] };
    quva: { total: number; rows: TripIncomeDetailRow[] };
    other: { total: number; rows: OtherIncomeDetailRow[] };
  };
  expense: {
    total: number;
    fargona: { total: number; rows: PointExpenseDetailRow[] };
    quva: { total: number; rows: PointExpenseDetailRow[] };
    outside: { total: number; rows: OutsideExpenseDetailRow[] };
  };
};

export type BalanceLedgerRow = {
  id: string;
  /** When this actually happened — accountantConfirmedAt for a handover
   * (real cash-in-hand moment), the category's own date field otherwise. */
  time: Date;
  /** Only set for handover rows: the day the money is FOR (handoverDate),
   * which can differ from `time` by days when a dispatcher's handover
   * isn't confirmed until later — see computeBalanceLedger's comment. */
  forDate?: Date;
  sign: "IN" | "OUT";
  category: string;
  subtitle: string;
  amount: number;
  /** Running balance right after this entry was applied — openingBalance
   * plus/minus every entry up to and including this one, in chronological
   * order. The most recent row's balanceAfter always equals
   * CashLedgerSummary.balance (see computeBalanceLedger). */
  balanceAfter: number;
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
  /** Every individual addition/deduction behind `balance`, since the
   * opening balance was set, most recent first — see computeBalanceLedger.
   * Empty when openingBalance is null (balance is meaningless then too). */
  balanceLedger: BalanceLedgerRow[];
  /** Scoped to the report page's own period/date (unlike everything else in
   * this type), both points combined, with a full drill-down: which point
   * it came from/went to, and the individual trip/expense records behind
   * each figure. Unlike computeCashBalance below, expense here also counts
   * vehicle repair/fuel/salary bills (not just what dispatchers hand over)
   * — a fuller "where did the money go" picture than the cash-handover-only
   * balance tracks. */
  cashDetail: CashDetail;
  confirmedHistory: ConfirmedHandoverRow[];
  payoutHistory: OwnerPayoutRow[];
  /** Whether a CashHandover row exists yet for that point on the report
   * page's own selected day (referenceDate) — regardless of whether the
   * accountant has confirmed it. Drives the "Топширилди/Топширилмади" badge
   * on each point card; only meaningful for a single day, not a week/month. */
  handoverSubmittedByPoint: Record<Point, boolean>;
  /** The calendar day right before referenceDate's own kirim−chiqim net —
   * always DAY-scoped regardless of the page's selected period, since this
   * is specifically "yesterday", not "the previous period". */
  yesterday: { dateLabel: string; balance: number };
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
// OwnerPayoutForm's date field is date-only (defaults to today, no time
// picker), so recordOwnerPayoutAction stores it at UTC midnight — but
// `since` is the precise instant the accountant physically counted cash.
// Comparing a same-day payout at 00:00 against a `since` set later that day
// (14:50, say) would wrongly exclude a payout that genuinely happened after
// the count — so the cutoff here widens to the whole calendar day `since`
// falls on, not the exact instant, for OwnerPayout specifically.
function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function computeCashBalance(opening?: { amount: number; setDate: Date } | null): Promise<number> {
  const openingBalance = opening === undefined ? await getLatestOpeningBalance() : opening;
  if (!openingBalance) return 0;
  const since = openingBalance.setDate;
  const sincePayoutCutoff = utcDayStart(since);

  const [confirmedHandovers, payoutAgg, expenseAgg, staffExpenseAgg, advanceAgg, salaryAgg, stationPaymentAgg] =
    await Promise.all([
      // Not an aggregate: a handover the accountant confirmed at a different
      // amount than the dispatcher declared (see confirmCashReceiptWith
      // AdjustmentAction) has confirmedAmount set, and that — not `amount`
      // — is what actually reached the cash pile, so each row needs its own
      // confirmedAmount-or-amount pick before summing.
      prisma.cashHandover.findMany({
        where: { accountantConfirmedAt: { gte: since } },
        select: { amount: true, confirmedAmount: true },
      }),
      prisma.ownerPayout.aggregate({ _sum: { amount: true }, where: { payoutDate: { gte: sincePayoutCutoff } } }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { category: { not: "FUEL" }, expenseDate: { gte: since } },
      }),
      // FARGONA/QUVA only — createHandoverForDate (dispatcher/actions.ts)
      // already nets that point's own StaffExpense (and Lunch — always
      // FARGONA/QUVA, Point has no other values) out of the handover amount
      // before the dispatcher hands it over, so subtracting them again here
      // double-counted every point-level expense a dispatcher paid out of
      // pocket. YOLDA/ISHXONA aren't tied to any handover, so they still
      // need to come off here — Lunch has no YOLDA/ISHXONA equivalent, so
      // it's dropped from this query entirely rather than filtered.
      prisma.staffExpense.aggregate({
        _sum: { amount: true },
        where: { point: { in: ["YOLDA", "ISHXONA"] }, expenseDate: { gte: since } },
      }),
      prisma.advance.aggregate({ _sum: { amount: true }, where: { givenDate: { gte: since } } }),
      // Filtered on paidAt (the exact moment "Ойлик бериш" was clicked per
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

  const confirmed = confirmedHandovers.reduce((s, h) => s + Number(h.confirmedAmount ?? h.amount), 0);
  const paidToOwner = Number(payoutAgg._sum.amount ?? BigInt(0));
  const expenses = Number(expenseAgg._sum.amount ?? BigInt(0));
  const staffExpenses = Number(staffExpenseAgg._sum.amount ?? BigInt(0));
  const advances = Number(advanceAgg._sum.amount ?? BigInt(0));
  const salaries = Number(salaryAgg._sum.netPay ?? BigInt(0));
  const stationPayments = Number(stationPaymentAgg._sum.paidAmount ?? BigInt(0));

  return (
    openingBalance.amount +
    confirmed -
    paidToOwner -
    expenses -
    staffExpenses -
    advances -
    salaries -
    stationPayments
  );
}

export async function getCashBalance(): Promise<number> {
  return computeCashBalance();
}

const BALANCE_POINT_LABELS: Record<string, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
  YOLDA: "Йўлда",
  ISHXONA: "Ишхона",
};

/**
 * Every individual row behind computeCashBalance's arithmetic, since the
 * same opening-balance cutoff, most recent first — a full reconciliation
 * ledger so a discrepancy against a physical cash count can be tracked down
 * entry by entry instead of only seeing the final total. Mirrors
 * computeCashBalance's categories exactly (same FUEL exclusion on Expense,
 * same paidAt-based Salary/StationPayment cutoffs) so the rows here always
 * sum to (balance − openingBalance.amount).
 */
async function computeBalanceLedger(since: Date, openingAmount: number): Promise<BalanceLedgerRow[]> {
  const [confirmed, payouts, expenses, staffExpenses, advances, salaries, stationPayments] =
    await Promise.all([
      prisma.cashHandover.findMany({
        where: { accountantConfirmedAt: { gte: since } },
        include: { dispatcherConfirmedByUser: true },
      }),
      // Same widened same-day cutoff as computeCashBalance — see utcDayStart.
      prisma.ownerPayout.findMany({
        where: { payoutDate: { gte: utcDayStart(since) } },
        include: { enteredByUser: true },
      }),
      prisma.expense.findMany({
        where: { category: { not: "FUEL" }, expenseDate: { gte: since } },
        include: { vehicle: true },
      }),
      // FARGONA/QUVA excluded — see computeCashBalance's own comment: their
      // StaffExpense (and all Lunch, dropped entirely here) is already
      // netted into the confirmed handover amount above, so listing it here
      // too would both double-count the balance and show the same real
      // expense as two separate rows.
      prisma.staffExpense.findMany({
        where: { point: { in: ["YOLDA", "ISHXONA"] }, expenseDate: { gte: since } },
        include: { enteredByUser: true },
      }),
      prisma.advance.findMany({ where: { givenDate: { gte: since } }, include: { user: true } }),
      prisma.salary.findMany({
        where: { status: "PAID", paidAt: { gte: since } },
        include: { user: true },
      }),
      prisma.stationPayment.findMany({ where: { paidAt: { gte: since } }, include: { station: true } }),
    ]);

  const rows: Omit<BalanceLedgerRow, "balanceAfter">[] = [
    ...confirmed.map((h) => {
      const adjusted = h.confirmedAmount !== null && h.confirmedAmount !== h.amount;
      return {
        id: h.id,
        time: h.accountantConfirmedAt as Date,
        forDate: h.handoverDate,
        sign: "IN" as const,
        category: "Топширилган",
        subtitle: adjusted
          ? `${BALANCE_POINT_LABELS[h.point] ?? h.point} · ${h.dispatcherConfirmedByUser.fullName} · дастлаб ${formatSom(Number(h.amount))}, сабаб: ${h.confirmedNote}`
          : `${BALANCE_POINT_LABELS[h.point] ?? h.point} · ${h.dispatcherConfirmedByUser.fullName}`,
        amount: Number(h.confirmedAmount ?? h.amount),
      };
    }),
    ...payouts.map((p) => ({
      id: p.id,
      time: p.payoutDate,
      sign: "OUT" as const,
      category: "Эгасига тўланган",
      subtitle: p.note ? `${p.enteredByUser.fullName} · ${p.note}` : p.enteredByUser.fullName,
      amount: Number(p.amount),
    })),
    ...expenses.map((e) => ({
      id: e.id,
      time: e.expenseDate,
      sign: "OUT" as const,
      category: OUTSIDE_EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      subtitle: e.note ? `${e.vehicle.plate} · ${e.note}` : e.vehicle.plate,
      amount: Number(e.amount),
    })),
    ...staffExpenses.map((e) => ({
      id: e.id,
      time: e.expenseDate,
      sign: "OUT" as const,
      category: `${BALANCE_POINT_LABELS[e.point] ?? e.point} · ${POINT_EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}`,
      subtitle: e.note ? `${e.enteredByUser.fullName} · ${e.note}` : e.enteredByUser.fullName,
      amount: Number(e.amount),
    })),
    ...advances.map((a) => ({
      id: a.id,
      time: a.givenDate,
      sign: "OUT" as const,
      category: "Аванс",
      subtitle: a.user.fullName,
      amount: Number(a.amount),
    })),
    ...salaries.map((s) => ({
      id: s.id,
      time: s.paidAt as Date,
      sign: "OUT" as const,
      category: "Ойлик",
      subtitle: s.user.fullName,
      amount: Number(s.netPay),
    })),
    ...stationPayments.map((p) => ({
      id: p.id,
      time: p.paidAt as Date,
      sign: "OUT" as const,
      category: "Ёқилғи станцияси тўлови",
      subtitle: p.station.name,
      amount: Number(p.paidAmount),
    })),
  ];

  // Walk chronologically (oldest first) to build up the running balance,
  // then reverse for display — most recent first, matching every other
  // history list in this app.
  const chronological = rows.sort((a, b) => a.time.getTime() - b.time.getTime());
  let running = openingAmount;
  const withBalance: BalanceLedgerRow[] = chronological.map((r) => {
    running += r.sign === "IN" ? r.amount : -r.amount;
    return { ...r, balanceAfter: running };
  });

  return withBalance.reverse();
}

const OUTSIDE_EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  FUEL: "Ёқилғи",
  REPAIR: "Таъмирлаш",
  SALARY: "Маош",
  INSURANCE: "Суғурта",
  TAX: "Солиқ",
  TOLL: "Йўл ҳақи",
  OTHER: "Бошқа",
};

const POINT_EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Шахсий озиқ-овқат",
  BOSHQA: "Бошқа расход",
};

// StaffExpensePoint has two more values than Point (FARGONA/QUVA) — a
// dispatcher never picks these (see toStaffExpensePoint in
// dispatcher/actions.ts), but the accountant's own "+ Бошқа расход" form
// does (see AddExpenseForm.tsx), so real rows can carry them. They aren't
// Farg'ona/Quva, so they belong in the "outside" bucket alongside vehicle
// expense/advance/salary/station payments — omitting them here silently
// understated the кунлик/ҳафталик/ойлик расход total by however much
// Йўлда/Ишхона expense a period had.
const OFF_POINT_LABELS: Record<string, string> = { YOLDA: "Йўлда", ISHXONA: "Ишхона" };

const PERIOD_WORDS: Record<Period, string> = { DAY: "Кунлик", WEEK: "Ҳафталик", MONTH: "Ойлик" };

function cashDetailRangeLabel(period: Period, from: Date, to: Date): string {
  if (period === "WEEK") return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
  if (period === "MONTH") return uzMonthName(from);
  return formatDayMonth(from);
}

/** The selected period's combined kirim/chiqim across both points, with a
 * full drill-down — same headline definition dispatcher/actions.ts's
 * createHandoverForDate uses per point (trip+otherIncome vs staffExpense+
 * lunch), just without the point filter, PLUS outside-point vehicle expense
 * (repair/fuel/salary/...) folded into the expense total too — unlike the
 * dispatcher-facing figure, this is meant to answer "where did the money
 * actually go" for whatever range the page has selected, not just what a
 * dispatcher physically hands over on a single day. */
async function computeCashDetail(period: Period, referenceDate: Date): Promise<CashDetail> {
  const { from, to } = rangeForPeriod(period, referenceDate);

  const [
    trips,
    drivers,
    vehicles,
    otherIncomes,
    staffExpenses,
    lunches,
    expenses,
    advances,
    salaries,
    stationPayments,
  ] = await Promise.all([
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to } },
      select: {
        id: true,
        createdAt: true,
        kind: true,
        point: true,
        vehicleId: true,
        driverId: true,
        revenue: true,
        note: true,
      },
    }),
    prisma.driver.findMany({ include: { user: true } }),
    prisma.vehicle.findMany({ select: { id: true, plate: true } }),
    prisma.otherIncome.findMany({
      where: { incomeDate: { gte: from, lte: to } },
      include: { enteredByUser: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.staffExpense.findMany({
      where: { expenseDate: { gte: from, lte: to }, category: { not: "OBED" } },
      include: { enteredByUser: true },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.lunch.findMany({
      where: { lunchDate: { gte: from, lte: to } },
      include: { user: true },
      orderBy: { lunchDate: "desc" },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      include: { vehicle: true },
      orderBy: { expenseDate: "desc" },
    }),
    // Not point-attributable (tied to an employee, not Farg'ona/Quva), but
    // still real cash leaving the company today — folded into "outside"
    // alongside the generic vehicle Expense above so "Умумий кунлик расход"
    // reflects everything, not just what a dispatcher physically hands over.
    prisma.advance.findMany({
      where: { givenDate: { gte: from, lte: to } },
      include: { user: true },
      orderBy: { givenDate: "desc" },
    }),
    prisma.salary.findMany({
      where: { status: "PAID", paidAt: { gte: from, lte: to } },
      include: { user: true },
      orderBy: { paidAt: "desc" },
    }),
    prisma.stationPayment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      include: { station: true },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const tripRows: (TripIncomeDetailRow & { point: Point })[] = trips
    .map((t) => ({
      id: t.id,
      time: t.createdAt,
      point: t.point,
      kind: t.kind,
      vehiclePlate: vehicleById.get(t.vehicleId)?.plate ?? "—",
      driverName: driverById.get(t.driverId)?.user.fullName ?? "—",
      amount: Number(t.revenue),
      note: t.note,
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());
  const fargonaTripRows = tripRows.filter((t) => t.point === "FARGONA");
  const quvaTripRows = tripRows.filter((t) => t.point === "QUVA");

  const otherIncomeRows: OtherIncomeDetailRow[] = otherIncomes.map((i) => ({
    id: i.id,
    time: i.createdAt,
    point: i.point,
    category: OTHER_INCOME_CATEGORY_LABELS[i.category] ?? i.category,
    amount: Number(i.amount),
    plateNumber: i.plateNumber,
    note: i.note,
    enteredByName: i.enteredByUser.fullName,
  }));

  const fargonaExpenseRows: PointExpenseDetailRow[] = [
    ...staffExpenses
      .filter((e) => e.point === "FARGONA")
      .map((e) => ({
        id: e.id,
        time: e.expenseDate,
        category: POINT_EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        amount: Number(e.amount),
        personName: e.enteredByUser.fullName,
        note: e.note,
      })),
    ...lunches
      .filter((l) => l.point === "FARGONA")
      .map((l) => ({
        id: l.id,
        time: l.lunchDate,
        category: "Обед",
        amount: Number(l.amount),
        personName: l.user.fullName,
        note: null,
      })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());
  const quvaExpenseRows: PointExpenseDetailRow[] = [
    ...staffExpenses
      .filter((e) => e.point === "QUVA")
      .map((e) => ({
        id: e.id,
        time: e.expenseDate,
        category: POINT_EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        amount: Number(e.amount),
        personName: e.enteredByUser.fullName,
        note: e.note,
      })),
    ...lunches
      .filter((l) => l.point === "QUVA")
      .map((l) => ({
        id: l.id,
        time: l.lunchDate,
        category: "Обед",
        amount: Number(l.amount),
        personName: l.user.fullName,
        note: null,
      })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  const outsideExpenseRows: OutsideExpenseDetailRow[] = [
    ...expenses.map((e) => ({
      id: e.id,
      time: e.expenseDate,
      subtitle: e.vehicle.plate,
      category: OUTSIDE_EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      amount: Number(e.amount),
      note: e.note,
    })),
    ...staffExpenses
      .filter((e) => e.point === "YOLDA" || e.point === "ISHXONA")
      .map((e) => ({
        id: e.id,
        time: e.expenseDate,
        subtitle: `${OFF_POINT_LABELS[e.point]} · ${e.enteredByUser.fullName}`,
        category: POINT_EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        amount: Number(e.amount),
        note: e.note,
      })),
    ...advances.map((a) => ({
      id: a.id,
      time: a.givenDate,
      subtitle: a.user.fullName,
      category: "Аванс",
      amount: Number(a.amount),
      note: null,
    })),
    ...salaries.map((s) => ({
      id: s.id,
      time: s.paidAt as Date,
      subtitle: s.user.fullName,
      category: "Ойлик",
      amount: Number(s.netPay),
      note: null,
    })),
    ...stationPayments.map((p) => ({
      id: p.id,
      time: p.paidAt as Date,
      subtitle: p.station.name,
      category: "Ёқилғи станцияси тўлови",
      amount: Number(p.paidAmount),
      note: null,
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  const sum = (arr: { amount: number }[]) => arr.reduce((s, r) => s + r.amount, 0);
  const fargonaIncomeTotal = sum(fargonaTripRows);
  const quvaIncomeTotal = sum(quvaTripRows);
  const otherIncomeTotal = sum(otherIncomeRows);
  const fargonaExpenseTotal = sum(fargonaExpenseRows);
  const quvaExpenseTotal = sum(quvaExpenseRows);
  const outsideExpenseTotal = sum(outsideExpenseRows);

  return {
    periodWord: PERIOD_WORDS[period],
    rangeLabel: cashDetailRangeLabel(period, from, to),
    income: {
      total: fargonaIncomeTotal + quvaIncomeTotal + otherIncomeTotal,
      fargona: { total: fargonaIncomeTotal, rows: fargonaTripRows },
      quva: { total: quvaIncomeTotal, rows: quvaTripRows },
      other: { total: otherIncomeTotal, rows: otherIncomeRows },
    },
    expense: {
      total: fargonaExpenseTotal + quvaExpenseTotal + outsideExpenseTotal,
      fargona: { total: fargonaExpenseTotal, rows: fargonaExpenseRows },
      quva: { total: quvaExpenseTotal, rows: quvaExpenseRows },
      outside: { total: outsideExpenseTotal, rows: outsideExpenseRows },
    },
  };
}

/**
 * balance/pointPending/confirmedHistory/payoutHistory are deliberately not
 * scoped to a period/date — a running all-time cash-on-hand balance, so
 * switching the date picker must not change them. cashDetail is the one
 * exception (see its own doc comment) — period/referenceDate only affect it.
 */
export async function getCashLedgerSummary(period: Period, referenceDate: Date): Promise<CashLedgerSummary> {
  const openingBalance = await getLatestOpeningBalance();
  const referenceDay = utcDayStart(referenceDate);
  const yesterdayDate = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);

  const [pending, confirmed, payouts, balance, balanceLedger, cashDetail, handoversToday, yesterdayDetail] =
    await Promise.all([
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
      openingBalance
        ? computeBalanceLedger(openingBalance.setDate, openingBalance.amount)
        : Promise.resolve([]),
      computeCashDetail(period, referenceDate),
      prisma.cashHandover.findMany({
        where: { handoverDate: referenceDay, point: { in: ["FARGONA", "QUVA"] } },
        select: { point: true },
      }),
      computeCashDetail("DAY", yesterdayDate),
    ]);

  const handoverSubmittedByPoint: Record<Point, boolean> = {
    FARGONA: handoversToday.some((h) => h.point === "FARGONA"),
    QUVA: handoversToday.some((h) => h.point === "QUVA"),
  };

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
    balanceLedger,
    cashDetail,
    confirmedHistory: confirmed.map((h) => ({
      id: h.id,
      handoverDate: h.handoverDate,
      amount: Number(h.amount),
      point: h.point,
      dispatcherName: h.dispatcherConfirmedByUser.fullName,
      accountantName: h.accountantConfirmedByUser?.fullName ?? "—",
      note: h.note,
      confirmedAmount: h.confirmedAmount !== null ? Number(h.confirmedAmount) : null,
      confirmedNote: h.confirmedNote,
    })),
    payoutHistory: payouts.map((p) => ({
      id: p.id,
      payoutDate: p.payoutDate,
      amount: Number(p.amount),
      note: p.note,
      enteredByName: p.enteredByUser.fullName,
    })),
    handoverSubmittedByPoint,
    yesterday: {
      dateLabel: yesterdayDetail.rangeLabel,
      balance: yesterdayDetail.income.total - yesterdayDetail.expense.total,
    },
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
