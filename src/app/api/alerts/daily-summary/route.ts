import { NextResponse } from "next/server";
import { getCashLedgerSummary } from "@/lib/ownerPayout";
import { formatSom } from "@/lib/format";
import { notifyRole } from "@/lib/telegram";

function signed(n: number): string {
  return `${n >= 0 ? "+" : "−"}${formatSom(Math.abs(n))}`;
}

// Runs once daily, near end of day (see .github/workflows/daily-alerts.yml)
// — the same Фарғона/Қува/Бошқа breakdown the report page's cash card shows
// (cashDetail), plus the running Эгасига берилмаган қолдиқ balance
// (unrelated to today specifically — see CashLedgerSummary's own comment),
// pushed to the owner instead of waiting for someone to open the dashboard.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cashLedger = await getCashLedgerSummary("DAY", new Date());
  const { cashDetail } = cashLedger;
  const dailyBalance = cashDetail.income.total - cashDetail.expense.total;

  await notifyRole(
    "OWNER",
    `📊 <b>Кунлик хулоса · ${cashDetail.rangeLabel}</b>\n\n` +
      `Фарғона: ${formatSom(cashDetail.income.fargona.total)} − ${formatSom(cashDetail.expense.fargona.total)}\n` +
      `Қува: ${formatSom(cashDetail.income.quva.total)} − ${formatSom(cashDetail.expense.quva.total)}\n` +
      `Бошқа тушум: ${formatSom(cashDetail.income.other.total)}\n` +
      `Бошқа чиқим: ${formatSom(cashDetail.expense.outside.total)}\n\n` +
      `Кунлик қолдиқ: ${formatSom(cashDetail.income.total)} − ${formatSom(cashDetail.expense.total)} = ${signed(dailyBalance)}\n\n` +
      `Эгасига берилмаган қолдиқ: ${formatSom(cashLedger.balance)}`
  );

  return NextResponse.json({ ok: true });
}
