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
