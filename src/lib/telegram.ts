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

/**
 * A role's env var (or TELEGRAM_CHANNEL_ID) can hold more than one chat id,
 * comma-separated (e.g. "238992785,5006989") — some roles have more than
 * one real person who needs the same alerts (e.g. two owners).
 */
export function parseChatIds(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

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
 * Sends to the given role's (or roles') configured chat(s), plus the
 * broadcast channel (TELEGRAM_CHANNEL_ID) if one is set — all deduped
 * together in one Set, so a chat that happens to be one role's chat AND
 * the channel AND another of the passed-in roles' chat still only gets the
 * message once. Pass an array when one alert genuinely concerns more than
 * one role (e.g. the movement-watch alert going to both OWNER and
 * MECHANIC) — calling notifyRole separately per role would double-send to
 * the shared channel instead. A role whose env var isn't set yet is
 * silently skipped rather than throwing, so wiring up one person doesn't
 * block the others already working.
 */
export async function notifyRole(role: AlertRole | AlertRole[], text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN .env da yo'q");

  const roles = Array.isArray(role) ? role : [role];
  const roleChatIds = roles.flatMap((r) => parseChatIds(process.env[ROLE_ENV_VAR[r]]));
  const channelIds = parseChatIds(process.env.TELEGRAM_CHANNEL_ID);
  const targets = new Set([...roleChatIds, ...channelIds]);

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
