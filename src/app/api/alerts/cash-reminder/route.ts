import { NextResponse } from "next/server";
import { notifyRole } from "@/lib/telegram";
import { buildCashReminderReport } from "@/lib/telegramReports";

// Runs once daily, close to end of day (see .github/workflows/daily-alerts.yml)
// — checks whether each point's dispatcher has submitted today's
// CashHandover yet (same definition FleetDashboard's Топширилди/Топширилмади
// badge uses), regardless of whether the accountant has confirmed it. Only
// pushes when something's actually missing — see /pul (api/telegram/
// webhook) for an unconditional, on-demand version of this same report.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, hasIssue } = await buildCashReminderReport();
  if (hasIssue) await notifyRole("ACCOUNTANT", message);

  return NextResponse.json({ ok: true, hasIssue });
}
