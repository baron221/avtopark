import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/telegram";
import { buildCashReminderReport, buildOilDueReport, buildDailySummaryReport } from "@/lib/telegramReports";

const WELCOME =
  "Салом! Қуйидаги буйруқлар орқали хоҳлаган пайтда ҳисобот сўраш мумкин:\n\n" +
  "/hisobot — кунлик касса хулосаси\n" +
  "/moy — мой алмаштириш ҳолати\n" +
  "/pul — пул топшириш ҳолати";

// Telegram calls this every time someone messages the bot (registered by
// hand via a one-off setWebhook call — see the daily-alerts cron routes
// for the scheduled, conditional version of these same reports). Reuses
// CRON_SECRET as the webhook's shared secret: one already-deployed value
// is simpler than asking Vercel for yet another env var, and the trust
// boundary is identical ("prove this request actually came from us").
// Any of the three chats already wired up for cron alerts (mechanic/
// accountant/owner) can use any command — all trusted staff already
// receiving alerts, no need for per-role restrictions.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const chatId: string | undefined = update?.message?.chat?.id?.toString();
  const text: string | undefined = update?.message?.text;
  if (!chatId || !text) return NextResponse.json({ ok: true });

  const knownChats = new Set(
    [process.env.TELEGRAM_CHAT_MECHANIC, process.env.TELEGRAM_CHAT_ACCOUNTANT, process.env.TELEGRAM_CHAT_OWNER].filter(
      (id): id is string => !!id
    )
  );
  if (!knownChats.has(chatId)) return NextResponse.json({ ok: true });

  const command = text.split(/[\s@]/)[0];

  try {
    if (command === "/hisobot") {
      const report = await buildDailySummaryReport();
      await sendMessage(chatId, report.message);
    } else if (command === "/moy") {
      const report = await buildOilDueReport();
      await sendMessage(chatId, report.message);
    } else if (command === "/pul") {
      const report = await buildCashReminderReport();
      await sendMessage(chatId, report.message);
    } else if (command === "/start" || command === "/yordam" || command === "/help") {
      await sendMessage(chatId, WELCOME);
    }
  } catch (err) {
    await sendMessage(chatId, `Хатолик юз берди: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json({ ok: true });
}
