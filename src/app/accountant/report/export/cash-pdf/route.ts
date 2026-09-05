import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCashLedgerSummary } from "@/lib/ownerPayout";
import { hasModuleAccess } from "@/lib/access";
import type { Period } from "@/lib/dashboard";

// pdf-lib's StandardFonts (Helvetica) only encode WinAnsi/Latin glyphs, and
// this report's text — category/subtitle/note, point names — is Cyrillic
// like the rest of the app. DejaVu Sans (bundled as a real TTF, not a
// web-optimized woff) has full Cyrillic coverage and, unlike an earlier
// hand-converted woff->ttf attempt, round-trips correctly (verified via PDF
// text extraction against real data, digits included).
const FONTS_DIR = path.join(process.cwd(), "src/lib/fonts");

const INDIGO = rgb(0.31, 0.27, 0.9);
const HEADING = rgb(0.12, 0.12, 0.17);
const MUTED = rgb(0.42, 0.42, 0.5);
const GREEN = rgb(0.11, 0.62, 0.42);
const RED = rgb(0.85, 0.33, 0.31);
const LINE = rgb(0.87, 0.87, 0.91);

function isPeriod(value: string | null): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASHKENT_TZ = "Asia/Tashkent";

function fmtDate(d: Date) {
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", timeZone: TASHKENT_TZ });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: TASHKENT_TZ });
}
function fmtSom(n: number) {
  return `${Math.round(n).toLocaleString("uz-UZ").replace(/,/g, " ")} сўм`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");
  const period: Period = isPeriod(periodParam) ? periodParam : "DAY";
  const dateParam = searchParams.get("date");
  const dateStr = dateParam && DATE_RE.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);
  const referenceDate = new Date(`${dateStr}T00:00:00Z`);

  const cashLedger = await getCashLedgerSummary(period, referenceDate);
  const { cashDetail } = cashLedger;
  const dailyBalance = cashDetail.income.total - cashDetail.expense.total;

  const PAGE_W = 420;
  const PAGE_H = 595;
  const LEFT = 36;
  const RIGHT = PAGE_W - 36;
  const BOTTOM_MARGIN = 40;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "DejaVuSans.ttf")),
    readFile(path.join(FONTS_DIR, "DejaVuSans-Bold.ttf")),
  ]);
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 40;

  function ensureSpace(need: number) {
    if (y - need < BOTTOM_MARGIN) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
    }
  }

  function title(text: string) {
    ensureSpace(24);
    page.drawText(text, { x: LEFT, y, size: 16, font: bold, color: HEADING });
    y -= 22;
  }
  function subtitle(text: string) {
    ensureSpace(16);
    page.drawText(text, { x: LEFT, y, size: 10, font, color: MUTED });
    y -= 18;
  }
  function hr() {
    ensureSpace(8);
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.75, color: LINE });
    y -= 12;
  }
  function row(label: string, value: string, opts?: { boldLabel?: boolean; color?: ReturnType<typeof rgb>; indent?: number }) {
    ensureSpace(16);
    const x = LEFT + (opts?.indent ?? 0);
    page.drawText(label, { x, y, size: 10.5, font: opts?.boldLabel ? bold : font, color: HEADING });
    const valueWidth = bold.widthOfTextAtSize(value, 10.5);
    page.drawText(value, { x: RIGHT - valueWidth, y, size: 10.5, font: bold, color: opts?.color ?? HEADING });
    y -= 16;
  }
  function itemRow(dateLabel: string, desc: string, value: string) {
    ensureSpace(13);
    page.drawText(`${dateLabel} · ${desc}`, { x: LEFT + 14, y, size: 8.5, font, color: MUTED });
    const valueWidth = font.widthOfTextAtSize(value, 8.5);
    page.drawText(value, { x: RIGHT - valueWidth, y, size: 8.5, font, color: MUTED });
    y -= 12;
  }
  function sectionGap() {
    y -= 6;
  }

  title(`Касса ҳисоботи · ${cashDetail.periodWord}`);
  subtitle(`Сана: ${cashDetail.rangeLabel}`);
  hr();

  row(`Умумий ${cashDetail.periodWord.toLowerCase()} тушум`, fmtSom(cashDetail.income.total), {
    boldLabel: true,
    color: GREEN,
  });
  row("Фарғона", fmtSom(cashDetail.income.fargona.total), { indent: 12 });
  row("Қува", fmtSom(cashDetail.income.quva.total), { indent: 12 });
  row("Бошқа кирим", fmtSom(cashDetail.income.other.total), { indent: 12 });
  for (const r of cashDetail.income.other.rows) {
    itemRow(
      `${fmtDate(r.time)} ${fmtTime(r.time)}`,
      [r.category, r.plateNumber, r.note].filter(Boolean).join(" · "),
      fmtSom(r.amount)
    );
  }
  sectionGap();

  row(`Умумий ${cashDetail.periodWord.toLowerCase()} расход`, fmtSom(cashDetail.expense.total), {
    boldLabel: true,
    color: RED,
  });
  row("Фарғона", fmtSom(cashDetail.expense.fargona.total), { indent: 12 });
  row("Қува", fmtSom(cashDetail.expense.quva.total), { indent: 12 });
  row("Бошқа чиқимлар", fmtSom(cashDetail.expense.outside.total), { indent: 12 });
  for (const r of cashDetail.expense.outside.rows) {
    itemRow(
      `${fmtDate(r.time)} ${fmtTime(r.time)}`,
      [r.category, r.subtitle, r.note].filter(Boolean).join(" · "),
      fmtSom(r.amount)
    );
  }
  sectionGap();
  hr();

  row("Кунлик қолдиқ (тушум − чиқим)", fmtSom(dailyBalance), {
    boldLabel: true,
    color: dailyBalance >= 0 ? GREEN : RED,
  });
  sectionGap();
  row("Кассадаги пул", fmtSom(cashLedger.balance), { boldLabel: true, color: INDIGO });
  if (cashLedger.openingBalance) {
    subtitle(
      `Бошланғич қолдиқ ${fmtSom(cashLedger.openingBalance.amount)} · ${fmtDate(cashLedger.openingBalance.setDate)}дан ҳисобланмоқда`
    );
  }

  const bytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kassa_hisoboti_${dateStr}.pdf"`,
    },
  });
}
