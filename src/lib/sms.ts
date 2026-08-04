// Eskiz.uz SMS gateway client (https://documenter.getpostman.com/view/663428/RWgqUxxh).
// Login tokens are valid ~30 days; cached in module scope and refreshed on
// a 401 rather than re-logging in on every send.

const ESKIZ_BASE_URL = "https://notify.eskiz.uz/api";

let cachedToken: string | null = null;

async function login(): Promise<string> {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  if (!email || !password) throw new Error("ESKIZ_EMAIL/ESKIZ_PASSWORD .env da yo'q");

  const res = await fetch(`${ESKIZ_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data?.data?.token) {
    throw new Error(`Eskiz login xato: ${JSON.stringify(data)}`);
  }
  cachedToken = data.data.token as string;
  return cachedToken;
}

/**
 * Best-effort SMS send — never throws. Callers fire this after their own
 * write succeeds, so a gateway/credential problem never blocks a trip or
 * lunch entry from being saved. Errors are logged server-side only.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  try {
    if (!process.env.ESKIZ_EMAIL || !process.env.ESKIZ_PASSWORD) return;

    const digits = phone.replace(/\D/g, "");
    const mobilePhone = digits.startsWith("998") ? digits : `998${digits.slice(-9)}`;
    const from = process.env.ESKIZ_SENDER || "4546";

    let token = cachedToken ?? (await login());
    let res = await sendOnce(token, mobilePhone, message, from);
    if (res.status === 401) {
      token = await login();
      res = await sendOnce(token, mobilePhone, message, from);
    }
    if (!res.ok) {
      const body = await res.text();
      console.error("Eskiz SMS yuborilmadi:", res.status, body);
    }
  } catch (err) {
    console.error("Eskiz SMS xato:", err);
  }
}

function sendOnce(token: string, mobilePhone: string, message: string, from: string) {
  return fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mobile_phone: mobilePhone, message, from }),
  });
}
