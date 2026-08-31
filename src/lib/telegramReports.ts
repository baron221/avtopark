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

export async function buildDailySummaryReport(referenceDate: Date = new Date()): Promise<{ message: string }> {
  const cashLedger = await getCashLedgerSummary("DAY", referenceDate);
  const { cashDetail } = cashLedger;
  const dailyBalance = cashDetail.income.total - cashDetail.expense.total;

  const message =
    `📊 <b>Кунлик хулоса · ${cashDetail.rangeLabel}</b>\n\n` +
    `Фарғона: ${formatSom(cashDetail.income.fargona.total)} − ${formatSom(cashDetail.expense.fargona.total)}\n` +
    `Қува: ${formatSom(cashDetail.income.quva.total)} − ${formatSom(cashDetail.expense.quva.total)}\n` +
    `Бошқа тушум: ${formatSom(cashDetail.income.other.total)}\n` +
    `Бошқа чиқим: ${formatSom(cashDetail.expense.outside.total)}\n\n` +
    `Кунлик қолдиқ: ${formatSom(cashDetail.income.total)} − ${formatSom(cashDetail.expense.total)} = ${signed(dailyBalance)}\n\n` +
    `Эгасига берилмаган қолдиқ: ${formatSom(cashLedger.balance)}`;

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
      `⏳ Бугунги ${pointList} пункти(лари) ҳали бухгалтерга топширилмаган ва тасдиқланмаган.\n` +
      `Бухгалтер тасдиқласа, автоматик жўнатаман.\n\n` +
      `Қуйида кечаги ҳисобот:\n\n${yesterdayMessage}`,
  };
}

/** Called after a cash handover confirm — if this confirm was for today
 * and it's the one that completes both points, push today's summary to
 * the owner right away instead of making them wait for /hisobot or the
 * end-of-day cron. A no-op for confirming a backlog day's handover. */
export async function maybeAutoSendDailySummary(handoverDate: Date): Promise<void> {
  const today = utcDayStart(new Date());
  if (utcDayStart(handoverDate).getTime() !== today.getTime()) return;

  const { ready } = await getCashReadiness(today);
  if (!ready) return;

  const { message } = await buildDailySummaryReport();
  await notifyRole("OWNER", message);
}
