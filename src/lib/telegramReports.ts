import { prisma } from "@/lib/prisma";
import { getCashLedgerSummary } from "@/lib/ownerPayout";
import { formatSom } from "@/lib/format";

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

export async function buildOilDueReport(): Promise<{ message: string; hasIssue: boolean }> {
  const vehicles = await prisma.vehicle.findMany({ select: { id: true, plate: true, model: true, odometerKm: true } });
  const oilChanges = await prisma.oilChange.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) } },
    orderBy: { changedAt: "desc" },
    select: { vehicleId: true, odometerKm: true, intervalKm: true },
  });
  const latestByVehicle = new Map<string, (typeof oilChanges)[number]>();
  for (const oc of oilChanges) {
    if (!latestByVehicle.has(oc.vehicleId)) latestByVehicle.set(oc.vehicleId, oc);
  }

  const due: { plate: string; model: string }[] = [];
  for (const vehicle of vehicles) {
    const last = latestByVehicle.get(vehicle.id);
    if (!last) continue;
    const dueKm = last.odometerKm + last.intervalKm;
    if (vehicle.odometerKm != null && vehicle.odometerKm >= dueKm) {
      due.push({ plate: vehicle.plate, model: vehicle.model });
    }
  }

  if (due.length > 0) {
    const list = due.map((v) => `• <b>${v.plate}</b> (${v.model})`).join("\n");
    return { hasIssue: true, message: `🔧 Мой алмаштириш муддати етган машиналар:\n\n${list}` };
  }
  return { hasIssue: false, message: "🔧 Ҳозирча мой алмаштириш муддати ўтган машина йўқ." };
}

export async function buildDailySummaryReport(): Promise<{ message: string }> {
  const cashLedger = await getCashLedgerSummary("DAY", new Date());
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
