// The app is used exclusively in Farg'ona/Quva (Asia/Tashkent), but the
// server itself runs in UTC (Vercel) — without pinning the timezone here,
// toLocaleTimeString silently renders the UTC hour instead, 5 hours behind
// what dispatchers/drivers actually see on the clock.
const TASHKENT_TZ = "Asia/Tashkent";

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: TASHKENT_TZ });
}

// Deliberately not toLocaleDateString: Node's bundled ICU and a browser's
// formats the same "uz-UZ" day/month differently (e.g. "12/08" vs "08-12"),
// which is harmless in a server component (renders once, server-side only)
// but breaks hydration in a "use client" component whose unconditionally-
// visible markup includes it — confirmed via a local repro this session.
export function formatDayMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
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

// pdf-lib's StandardFonts only encode WinAnsi (Latin) glyphs — embedding a
// real Cyrillic font was tried and abandoned (pdf-lib silently produced
// wrong glyphs even for digits/punctuation with a hand-converted TTF, not
// worth the risk for financial figures). Every PDF export instead
// transliterates its Cyrillic text to Latin Uzbek through this map, which
// StandardFonts can render correctly.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h",
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "Yo", Ж: "J", З: "Z", И: "I",
  Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T",
  У: "U", Ф: "F", Х: "X", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sh", Ъ: "", Ы: "I", Ь: "",
  Э: "E", Ю: "Yu", Я: "Ya", Ў: "O'", Қ: "Q", Ғ: "G'", Ҳ: "H",
};

export function cyrillicToLatin(text: string): string {
  return Array.from(text)
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join("");
}
