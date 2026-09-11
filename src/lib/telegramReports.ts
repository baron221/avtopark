import { prisma } from "@/lib/prisma";
import { getCashLedgerSummary } from "@/lib/ownerPayout";
import { formatSom } from "@/lib/format";
import { notifyRole } from "@/lib/telegram";
import { estimateCurrentOdometerKm, resolveOdometerBase } from "@/lib/oilChange";

// Shared with the three cron-triggered alert routes (api/alerts/*) — each
// builds its own message text here, then either the cron route decides
// whether it's worth pushing (only when something's actually wrong, to
// avoid daily noise) or the Telegram webhook (api/telegram/webhook) sends
// it back unconditionally, since someone explicitly asked for it.

const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "−"}${formatSom(Math.abs(n))}`;
}

export async function buildCashReminderReport(): Promise<{ message: string; hasIssue: boolean }> {
  const today = utcDayStart(new Date());
  const handovers = await prisma.cashHandover.findMany({
    where: { handoverDate: today, point: { in: ["FARGONA", "QUVA"] } },
    select: { point: true },
  });
  const submitted = new Set(handovers.map((h) => h.point));
  const missing = (["FARGONA", "QUVA"] as const).filter((p) => !submitted.has(p));

  if (missing.length > 0) {
    return {
      hasIssue: true,
      message: `💰 Бугун ${missing.map((p) => `<b>${POINT_LABELS[p]}</b>`).join(", ")} пункти(лари) ҳали пул топширмади.`,
    };
  }
  return { hasIssue: false, message: "💰 Бугун ҳар иккала пункт ҳам пул топширган." };
}

const OIL_WARNING_KM = 500;

type OilRow = { plate: string; model: string; currentKm: number | null; kmRemaining: number | null; rank: number };

/** Same km-remaining math and same GPS-estimated current km as the
 * mechanic vehicle page's own badge (estimateCurrentOdometerKm doesn't
 * touch Wialon, just sums the already-synced VehicleMileage rows, so this
 * is cheap even for the whole fleet at once). rank: 3 = overdue,
 * 2 = nearing (within OIL_WARNING_KM), 1 = no oil-change history to judge
 * by, 0 = fine. Shared by /moy (all rows) and the daily cron (rank >= 2
 * only). */
async function computeOilRows(): Promise<OilRow[]> {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, plate: true, model: true, odometerKm: true, odometerAsOf: true, purchaseDate: true },
    orderBy: { plate: "asc" },
  });
  const oilChanges = await prisma.oilChange.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) } },
    orderBy: { changedAt: "desc" },
    select: { vehicleId: true, odometerKm: true, intervalKm: true, changedAt: true },
  });
  const latestByVehicle = new Map<string, (typeof oilChanges)[number]>();
  for (const oc of oilChanges) {
    if (!latestByVehicle.has(oc.vehicleId)) latestByVehicle.set(oc.vehicleId, oc);
  }

  const rows: OilRow[] = [];
  for (const vehicle of vehicles) {
    const last = latestByVehicle.get(vehicle.id);
    const base = resolveOdometerBase(last ?? null, vehicle);

    const estimated = base ? await estimateCurrentOdometerKm(vehicle.id, base.km, base.date) : null;
    const currentKm = estimated ?? vehicle.odometerKm ?? base?.km ?? null;

    if (!last) {
      rows.push({ plate: vehicle.plate, model: vehicle.model, currentKm, kmRemaining: null, rank: 1 });
      continue;
    }

    const nextDueKm = last.odometerKm + last.intervalKm;
    const kmRemaining = currentKm != null ? nextDueKm - currentKm : null;
    const rank = kmRemaining == null ? 1 : kmRemaining <= 0 ? 3 : kmRemaining <= OIL_WARNING_KM ? 2 : 0;
    rows.push({ plate: vehicle.plate, model: vehicle.model, currentKm, kmRemaining, rank });
  }

  return rows.sort((a, b) => b.rank - a.rank);
}

function formatOilRow(r: OilRow): string {
  const kmText = r.currentKm != null ? `${r.currentKm.toLocaleString("uz-UZ")} км` : "км номаълум";
  if (r.kmRemaining == null) {
    return `⚪ <b>${r.plate}</b> (${r.model}) — жами ${kmText}, мой тарихи йўқ`;
  }
  if (r.kmRemaining <= 0) {
    return `🔴 <b>${r.plate}</b> (${r.model}) — жами ${kmText}, муддати ${Math.abs(r.kmRemaining).toLocaleString("uz-UZ")} км олдин ўтган`;
  }
  if (r.kmRemaining <= OIL_WARNING_KM) {
    return `🟡 <b>${r.plate}</b> (${r.model}) — жами ${kmText}, ${r.kmRemaining.toLocaleString("uz-UZ")} км қолди`;
  }
  return `🟢 <b>${r.plate}</b> (${r.model}) — жами ${kmText}, ${r.kmRemaining.toLocaleString("uz-UZ")} км қолди`;
}

/** Cron's actual handler (see api/alerts/oil-due) — pushes to the mechanic
 * once a vehicle enters the warning zone (kmRemaining <= OIL_WARNING_KM),
 * not just once it's fully overdue, so there's real lead time to schedule
 * the change instead of finding out the same day it's due. Re-alerts every
 * day a vehicle stays in that zone — a maintenance reminder should keep
 * nagging until the oil is actually changed, not fire once and go silent. */
export async function buildOilDueReport(): Promise<{ message: string; hasIssue: boolean }> {
  const rows = (await computeOilRows()).filter((r) => r.rank >= 2);

  if (rows.length > 0) {
    const list = rows.map(formatOilRow).join("\n");
    return { hasIssue: true, message: `🔧 <b>Мой алмаштиришга эътибор керак:</b>\n\n${list}` };
  }
  return { hasIssue: false, message: "🔧 Ҳозирча барча машиналарда мой яхши ҳолатда." };
}

/** /moy's actual handler: unlike buildOilDueReport (cron, silent unless
 * something needs attention), this always lists every vehicle. Sorted
 * most-urgent first so the list is useful even when it's long. */
export async function buildOilStatusReport(): Promise<{ message: string }> {
  const rows = await computeOilRows();
  const lines = rows.map(formatOilRow).join("\n");
  return { message: `🔧 <b>Барча машиналар — мой ҳолати</b>\n\n${lines}` };
}

// UTC-based, not formatDayMonth (which uses local getters) — `day` here is
// always a UTC-midnight Date (utcDayStart), so extracting it with local
// getters would only be correct when the running process's own timezone
// happens to be UTC (true on Vercel, not guaranteed everywhere this could
// run — see month.ts's own comment on the same bug class elsewhere).
function dayMonthLabel(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fullDateLabel(d: Date): string {
  return `${dayMonthLabel(d)}.${d.getUTCFullYear()}`;
}

/** Built once (by the accountant's own "Кунни якунлаш" button — see
 * sendDailyClosingReportAction — or on demand via /hisobot), never
 * automatically anymore: pushing this at a fixed cron time regardless of
 * whether the day's numbers were actually final turned out to be more noise
 * than signal, per explicit request. Sourced entirely from
 * getCashLedgerSummary's already-correct/tested row data (no separate
 * queries of its own) — the point/lunch/outside/other-income categories are
 * just regrouped for this specific presentation: Фарғона+Қува lunch combined
 * into one "Шофёрлар ва диспетчерлар обед, суви" line (even though Lunch
 * itself is fleet-wide, not point-scoped — see Lunch's own schema comment —
 * cashDetail splits its rows by point, they're just summed back together
 * here), Аванс and Ишхона (labelled "Офис расходлари") pulled out of the
 * generic "outside" bucket by category/subtitle, Йўлда shown only when
 * non-zero so an ordinary day's report isn't cluttered with an empty
 * category, "Бошқа кирим" printed as one "Бошқа кирим - <category>: <amount>"
 * line per category and the expense-side "Бошқа" bucket as one
 * "Бошқа - <note>: <amount>" line per row — both instead of a lump total
 * above the breakdown, which with a single row/category used to print the
 * exact same number twice — all per explicit request. */
export async function buildDailySummaryReport(referenceDate: Date = new Date()): Promise<{ message: string }> {
  const day = utcDayStart(referenceDate);
  const [totalVehicles, ledger] = await Promise.all([prisma.vehicle.count(), getCashLedgerSummary("DAY", day)]);
  const { cashDetail } = ledger;

  const ranVehicles = new Set(
    [...cashDetail.income.fargona.rows, ...cashDetail.income.quva.rows].map((r) => r.vehiclePlate)
  );

  // "Шахсий озиқ-овқат" (StaffExpense's OZIQ_OVQAT category) counts as lunch
  // here too, per explicit request — in practice it's the same driver-meal
  // spending as the Lunch model's own "Обед" rows, just logged through a
  // different form, so it belongs in the "обеди, сув" line rather than the
  // generic пункт line.
  const isLunch = (r: { category: string }) => r.category === "Обед" || r.category === "Шахсий озиқ-овқат";
  const fargonaPoint = cashDetail.expense.fargona.rows.filter((r) => !isLunch(r)).reduce((s, r) => s + r.amount, 0);
  const quvaPoint = cashDetail.expense.quva.rows.filter((r) => !isLunch(r)).reduce((s, r) => s + r.amount, 0);
  // Фарғона+Қува combined into one "Шофёрлар ва диспетчерлар обед, суви"
  // line, per explicit request — both points' drivers and dispatchers draw
  // from the same lunch/water budget, so a per-point split wasn't actually
  // useful here despite every other line staying point-separated.
  const lunchTotal = [...cashDetail.expense.fargona.rows, ...cashDetail.expense.quva.rows]
    .filter(isLunch)
    .reduce((s, r) => s + r.amount, 0);

  // cashDetail.expense.outside already excludes fuel/post-cutoff-repair
  // (NOT_MECHANIC_PAID_EXPENSE, applied at the source in computeCashDetail)
  // — the owner pays for those directly, never out of the accountant's
  // collected cash, so this report never needs to filter them out itself.
  const outside = cashDetail.expense.outside.rows;
  const isAdvance = (r: { category: string }) => r.category === "Аванс";
  const isIshxona = (r: { subtitle: string }) => r.subtitle.startsWith("Ишхона");
  const isYolda = (r: { subtitle: string }) => r.subtitle.startsWith("Йўлда");
  const advanceTotal = outside.filter(isAdvance).reduce((s, r) => s + r.amount, 0);
  const ishxonaTotal = outside.filter(isIshxona).reduce((s, r) => s + r.amount, 0);
  const yoldaTotal = outside.filter(isYolda).reduce((s, r) => s + r.amount, 0);
  const otherOutsideRows = outside.filter((r) => !isAdvance(r) && !isIshxona(r) && !isYolda(r));
  const otherOutsideTotal = otherOutsideRows.reduce((s, r) => s + r.amount, 0);
  // This bucket mixes a few different sources (Бошқа-point StaffExpense,
  // salary, fuel-station payments) with no shared category label worth
  // grouping by, so — per explicit request — each row gets its own
  // "Бошқа - <note or subtitle>: <amount>" line instead of a single lump
  // total (which, with just one row, used to print the exact same number
  // twice — once as the total, once as that row's own breakdown line).
  const otherOutsideLines = otherOutsideRows.map((r) => `Бошқа - ${r.note || r.subtitle}: ${formatSom(r.amount)}`);

  // cashDetail never carries OwnerPayout rows (see computeCashDetail) — an
  // owner payout made on `day` would otherwise be invisible in this figure,
  // same bug getCashLedgerSummary's own `yesterday` field had before it
  // switched to balanceLedger's balanceAfter. balanceLedger already covers
  // this exact day (fetched since the opening balance, which predates any
  // day this report runs for), so filter it down instead of another query.
  const dayPayoutTotal = ledger.balanceLedger
    .filter((r) => r.category === "Эгасига тўланган" && utcDayStart(r.time).getTime() === day.getTime())
    .reduce((s, r) => s + r.amount, 0);

  const tripIncome = cashDetail.income.fargona.total + cashDetail.income.quva.total;
  const totalExpense = fargonaPoint + quvaPoint + lunchTotal + advanceTotal + ishxonaTotal + yoldaTotal + otherOutsideTotal;
  const dailyBalance = tripIncome + cashDetail.income.other.total - totalExpense - dayPayoutTotal;

  // Broken down by category (Солиқ/Ойлик тўлов/ГПС/...) instead of one lump
  // sum, per explicit request — cashDetail.income.other.rows already
  // carries each row's category as its human label (OTHER_INCOME_CATEGORY_
  // LABELS, applied in computeCashDetail), so this is just a regroup. One
  // "Бошқа кирим - <category>: <amount>" line per category, not a lump
  // total above the breakdown — with a single category, the old format
  // printed the exact same number twice (same fix as the expense-side
  // "Бошқа" bucket below).
  const otherIncomeByCategory = new Map<string, number>();
  for (const r of cashDetail.income.other.rows) {
    otherIncomeByCategory.set(r.category, (otherIncomeByCategory.get(r.category) ?? 0) + r.amount);
  }
  const otherIncomeLines = [...otherIncomeByCategory.entries()].map(
    ([category, amount]) => `Бошқа кирим - ${category}: ${formatSom(amount)}`
  );

  const expenseLines = [
    `Қува пункти − ${formatSom(quvaPoint)}`,
    `Фарғона пункти − ${formatSom(fargonaPoint)}`,
    `Шофёрлар ва диспетчерлар обед, суви − ${formatSom(lunchTotal)}`,
    `Аванс − ${formatSom(advanceTotal)}`,
    `Офис расходлари − ${formatSom(ishxonaTotal)}`,
  ];
  if (yoldaTotal > 0) expenseLines.push(`Йўлда − ${formatSom(yoldaTotal)}`);
  expenseLines.push(...otherOutsideLines);

  const message =
    `<b>${fullDateLabel(day)}</b>\n\n` +
    `Жами ${totalVehicles} та мошина\n` +
    `${ranVehicles.size} та қатнаган машина\n\n` +
    `Кирим Қува-Фар-Қува: ${formatSom(tripIncome)}\n` +
    (otherIncomeLines.length > 0 ? `${otherIncomeLines.join("\n")}\n` : "") +
    `\n` +
    `Жами кирим: ${formatSom(tripIncome + cashDetail.income.other.total)} сум\n\n` +
    `<b>Расходлар</b>\n${expenseLines.join("\n")}\n\n` +
    `Жами расход: ${formatSom(totalExpense)} сум\n\n` +
    `${dayMonthLabel(day)} − Қолдиқ: ${signed(dailyBalance)} сум\n\n` +
    `${ledger.yesterday.dateLabel} − Қолдиқ: ${signed(ledger.yesterday.balance)} сум\n\n` +
    `Жами кассадаги пул: ${formatSom(ledger.balance)} сум.`;

  return { message };
}

/** Whether both points' cash for the given day has been handed over AND
 * confirmed by the accountant — the same "physically settled" bar
 * confirmCashReceiptAction/WithAdjustmentAction clears. Defaults to today,
 * UTC-day-aligned like buildCashReminderReport's own check. */
export async function getCashReadiness(
  day: Date = new Date()
): Promise<{ ready: boolean; missingPoints: ("FARGONA" | "QUVA")[] }> {
  const dayStart = utcDayStart(day);
  const handovers = await prisma.cashHandover.findMany({
    where: { handoverDate: dayStart, point: { in: ["FARGONA", "QUVA"] } },
    select: { point: true, accountantConfirmedAt: true },
  });
  const confirmedPoints = new Set(handovers.filter((h) => h.accountantConfirmedAt).map((h) => h.point));
  const missingPoints = (["FARGONA", "QUVA"] as const).filter((p) => !confirmedPoints.has(p));
  return { ready: missingPoints.length === 0, missingPoints };
}

/** /hisobot's actual handler: today's report is only meaningful once both
 * points' cash is confirmed, so show a "not ready yet" notice (naming
 * which point(s) are still pending) plus yesterday's report as the most
 * recent complete data, instead of a misleadingly-partial today. */
export async function buildOnDemandDailySummary(): Promise<{ message: string }> {
  const { ready, missingPoints } = await getCashReadiness();
  if (ready) return buildDailySummaryReport();

  const pointList = missingPoints.map((p) => `<b>${POINT_LABELS[p]}</b>`).join(", ");
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { message: yesterdayMessage } = await buildDailySummaryReport(yesterday);

  return {
    message:
      `⏳ Бугунги ${pointList} пункти(лари) ҳали бухгалтерга топширилмаган ва тасдиқланмаган.\n\n` +
      `Қуйида кечаги ҳисобот:\n\n${yesterdayMessage}`,
  };
}

/** The accountant's own "Кунни якунлаш" button (see
 * sendDailyClosingReportAction in accountant/report/actions.ts) — the only
 * way this report reaches the owner now besides an explicit /hisobot. No
 * cron and no auto-send-on-confirm anymore (both removed per request):
 * pushing this at a fixed time or the moment both points happened to get
 * confirmed was more noise than signal — the accountant decides when the
 * day is actually done. */
export async function sendDailyClosingReport(): Promise<void> {
  const { message } = await buildDailySummaryReport();
  await notifyRole("OWNER", message);
}
