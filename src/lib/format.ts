// The app is used exclusively in Farg'ona/Quva (Asia/Tashkent), but the
// server itself runs in UTC (Vercel) — without pinning the timezone here,
// toLocaleTimeString silently renders the UTC hour instead, 5 hours behind
// what dispatchers/drivers actually see on the clock.
const TASHKENT_TZ = "Asia/Tashkent";

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: TASHKENT_TZ });
}

export function formatSom(amount: number | bigint): string {
  const n = typeof amount === "bigint" ? Number(amount) : Math.round(amount);
  const negative = n < 0;
  const grouped = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (negative ? "-" : "") + grouped;
}

export function formatMillions(amount: number | bigint, withSuffix = false): string {
  const n = Number(amount);
  const mln = n / 1_000_000;
  const formatted = mln.toFixed(1).replace(".", ",");
  return withSuffix ? `${formatted} mln so'm` : `${formatted} mln`;
}

const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export function uzMonthName(date: Date): string {
  return UZ_MONTHS[date.getMonth()];
}

const UZ_WEEKDAYS_SHORT = ["Ya", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];

export function uzWeekdayShort(date: Date): string {
  return UZ_WEEKDAYS_SHORT[date.getDay()];
}
