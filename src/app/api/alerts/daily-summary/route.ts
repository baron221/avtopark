import { NextResponse } from "next/server";
import { notifyRole } from "@/lib/telegram";
import { buildDailySummaryReport } from "@/lib/telegramReports";

// Runs once daily, near end of day (see .github/workflows/daily-alerts.yml)
// — the same Фарғона/Қува/Бошқа breakdown the report page's cash card shows
// (cashDetail), plus the running Эгасига берилмаган қолдиқ balance
// (unrelated to today specifically — see CashLedgerSummary's own comment),
// pushed to the owner instead of waiting for someone to open the dashboard.
// Same report is also available on demand — see /hisobot (api/telegram/
// webhook).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await buildDailySummaryReport();
  await notifyRole("OWNER", message);

  return NextResponse.json({ ok: true });
}
