import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCashLedgerSummary } from "@/lib/ownerPayout";
import { hasModuleAccess } from "@/lib/access";
import type { Period } from "@/lib/dashboard";

const POINT_LABELS: Record<string, string> = { FARGONA: "Фарғона", QUVA: "Қува" };
const TASHKENT_TZ = "Asia/Tashkent";

function headerRow(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
}

function isPeriod(value: string | null): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmtDate(d: Date) {
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TASHKENT_TZ });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: TASHKENT_TZ });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const dateParam = searchParams.get("date");
  const dateStr = dateParam && DATE_RE.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);
  const referenceDate = new Date(`${dateStr}T00:00:00Z`);

  const cashLedger = await getCashLedgerSummary(period, referenceDate);
  const { cashDetail } = cashLedger;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Хулоса");
  summarySheet.columns = [
    { header: "Кўрсаткич", key: "label", width: 34 },
    { header: "Қиймат", key: "value", width: 22 },
  ];
  headerRow(summarySheet);
  summarySheet.addRow({ label: "Давр", value: cashDetail.periodWord });
  summarySheet.addRow({ label: "Сана", value: cashDetail.rangeLabel });
  summarySheet.addRow({
    label: "Эгасига берилмаган қолдиқ (харажатлардан кейин)",
    value: cashLedger.balance,
  }).getCell("value").numFmt = "#,##0";
  if (cashLedger.openingBalance) {
    summarySheet.addRow({ label: "Бошланғич қолдиқ", value: cashLedger.openingBalance.amount }).getCell(
      "value"
    ).numFmt = "#,##0";
    summarySheet.addRow({ label: "Бошланғич қолдиқ санаси", value: fmtDate(cashLedger.openingBalance.setDate) });
  }
  summarySheet.addRow({});
  for (const [label, value] of [
    [`Умумий ${cashDetail.periodWord.toLowerCase()} тушум`, cashDetail.income.total],
    ["  шундан Фарғона", cashDetail.income.fargona.total],
    ["  шундан Қува", cashDetail.income.quva.total],
    ["  шундан Бошқа кирим", cashDetail.income.other.total],
    [`Умумий ${cashDetail.periodWord.toLowerCase()} расход`, cashDetail.expense.total],
    ["  шундан Фарғона", cashDetail.expense.fargona.total],
    ["  шундан Қува", cashDetail.expense.quva.total],
    ["  шундан Бошқа чиқимлар", cashDetail.expense.outside.total],
  ] as const) {
    const row = summarySheet.addRow({ label, value });
    row.getCell("value").numFmt = "#,##0";
  }

  const incomeSheet = workbook.addWorksheet("Тушум · Фарғона ва Қува");
  incomeSheet.columns = [
    { header: "Пункт", key: "point", width: 12 },
    { header: "Сана", key: "date", width: 12 },
    { header: "Вақт", key: "time", width: 10 },
    { header: "Тури", key: "kind", width: 10 },
    { header: "Машина", key: "plate", width: 14 },
    { header: "Ҳайдовчи", key: "driver", width: 26 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "Изоҳ", key: "note", width: 30 },
  ];
  headerRow(incomeSheet);
  for (const [point, rows] of [
    ["FARGONA", cashDetail.income.fargona.rows],
    ["QUVA", cashDetail.income.quva.rows],
  ] as const) {
    for (const r of rows) {
      incomeSheet.addRow({
        point: POINT_LABELS[point],
        date: fmtDate(r.time),
        time: fmtTime(r.time),
        kind: r.kind === "ORDER" ? "Заказ" : "Рейс",
        plate: r.vehiclePlate,
        driver: r.driverName,
        amount: r.amount,
        note: r.note ?? "",
      });
    }
  }
  incomeSheet.getColumn("amount").numFmt = "#,##0";

  const otherIncomeSheet = workbook.addWorksheet("Бошқа кирим");
  otherIncomeSheet.columns = [
    { header: "Пункт", key: "point", width: 12 },
    { header: "Сана", key: "date", width: 12 },
    { header: "Вақт", key: "time", width: 10 },
    { header: "Тоифа", key: "category", width: 18 },
    { header: "Давлат рақами", key: "plate", width: 16 },
    { header: "Ким киритди", key: "enteredBy", width: 26 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "Изоҳ", key: "note", width: 30 },
  ];
  headerRow(otherIncomeSheet);
  for (const r of cashDetail.income.other.rows) {
    otherIncomeSheet.addRow({
      point: POINT_LABELS[r.point] ?? r.point,
      date: fmtDate(r.time),
      time: fmtTime(r.time),
      category: r.category,
      plate: r.plateNumber ?? "",
      enteredBy: r.enteredByName,
      amount: r.amount,
      note: r.note ?? "",
    });
  }
  otherIncomeSheet.getColumn("amount").numFmt = "#,##0";

  const expenseSheet = workbook.addWorksheet("Чиқим · Фарғона ва Қува");
  expenseSheet.columns = [
    { header: "Пункт", key: "point", width: 12 },
    { header: "Сана", key: "date", width: 12 },
    { header: "Вақт", key: "time", width: 10 },
    { header: "Тоифа", key: "category", width: 20 },
    { header: "Ким сарфлаган", key: "person", width: 26 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "Изоҳ", key: "note", width: 30 },
  ];
  headerRow(expenseSheet);
  for (const [point, rows] of [
    ["FARGONA", cashDetail.expense.fargona.rows],
    ["QUVA", cashDetail.expense.quva.rows],
  ] as const) {
    for (const r of rows) {
      expenseSheet.addRow({
        point: POINT_LABELS[point],
        date: fmtDate(r.time),
        time: fmtTime(r.time),
        category: r.category,
        person: r.personName,
        amount: r.amount,
        note: r.note ?? "",
      });
    }
  }
  expenseSheet.getColumn("amount").numFmt = "#,##0";

  const outsideExpenseSheet = workbook.addWorksheet("Бошқа чиқимлар");
  outsideExpenseSheet.columns = [
    { header: "Сана", key: "date", width: 12 },
    { header: "Вақт", key: "time", width: 10 },
    { header: "Тоифа", key: "category", width: 26 },
    { header: "Манба", key: "subtitle", width: 26 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "Изоҳ", key: "note", width: 30 },
  ];
  headerRow(outsideExpenseSheet);
  for (const r of cashDetail.expense.outside.rows) {
    outsideExpenseSheet.addRow({
      date: fmtDate(r.time),
      time: fmtTime(r.time),
      category: r.category,
      subtitle: r.subtitle,
      amount: r.amount,
      note: r.note ?? "",
    });
  }
  outsideExpenseSheet.getColumn("amount").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pul_hisoboti_${dateStr}.xlsx"`,
    },
  });
}
