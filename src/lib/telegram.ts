// Telegram Bot API client (https://core.telegram.org/bots/api#sendmessage).
// Each alert (gpsMovementWatch route, gps-signal route, cash-reminder route,
// oil-due route, daily-summary route) picks the one role it's actually
// about — this file's job is just delivering to that role's chat, plus
// always CC-ing the broadcast channel so one person (owner/admin) can see
// every alert without being individually subscribed to each role's chat.

export type AlertRole = "MECHANIC" | "ACCOUNTANT" | "OWNER";

const ROLE_ENV_VAR: Record<AlertRole, string> = {
  MECHANIC: "TELEGRAM_CHAT_MECHANIC",
  ACCOUNTANT: "TELEGRAM_CHAT_ACCOUNTANT",
  OWNER: "TELEGRAM_CHAT_OWNER",
};

async function sendToChat(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN .env da yo'q");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram хато (${chatId}): ${JSON.stringify(data)}`);
}

/**
 * Sends to the given role's configured chat, plus the broadcast channel
 * (TELEGRAM_CHANNEL_ID) if one is set — deduped, so a role that happens to
 * share the channel's chat id doesn't get the message twice. A role whose
 * env var isn't set yet is silently skipped rather than throwing, so
 * wiring up one person doesn't block the others already working.
 */
export async function notifyRole(role: AlertRole, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN .env da yo'q");

  const roleChatId = process.env[ROLE_ENV_VAR[role]];
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  const targets = new Set([roleChatId, channelId].filter((id): id is string => !!id));

  for (const chatId of targets) {
    await sendToChat(chatId, text);
  }
}

/**
 * Direct reply to one specific chat — used by the webhook route (api/
 * telegram/webhook) to answer an on-demand /hisobot-style command, unlike
 * notifyRole's broadcast-to-a-role-plus-channel pattern.
 */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN .env da yo'q");
  await sendToChat(chatId, text);
}
