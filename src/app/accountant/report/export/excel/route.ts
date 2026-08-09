import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { hasModuleAccess } from "@/lib/access";

const PERIOD_LABELS: Record<Period, string> = { DAY: "Кунлик", WEEK: "Ҳафталик", MONTH: "Ойлик" };
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

  const vm = await getOwnerDashboardVM(period, referenceDate);
  const activeVehicleCount = vm.vehicles.filter((v) => v.tripCount > 0 || v.income > 0).length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Хулоса");
  summarySheet.columns = [
    { header: "Кўрсаткич", key: "label", width: 32 },
    { header: "Қиймат", key: "value", width: 20 },
  ];
  headerRow(summarySheet);
  summarySheet.addRow({ label: "Давр", value: PERIOD_LABELS[period] });
  summarySheet.addRow({ label: "Сана", value: dateStr });
  summarySheet.addRow({ label: "Қатнашган машиналар", value: `${activeVehicleCount} / ${vm.vehicles.length}` });
  for (const [label, value] of [
    ["Жами тушум (сўм)", vm.totalIncome],
    ["Жами харажат (сўм)", vm.totalExpense],
    ["Соф фойда (сўм)", vm.netProfit],
  ] as const) {
    const row = summarySheet.addRow({ label, value });
    row.getCell("value").numFmt = "#,##0";
  }

  const expenseSheet = workbook.addWorksheet("Харажат таркиби");
  expenseSheet.columns = [
    { header: "Тоифа", key: "category", width: 26 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "%", key: "pct", width: 10 },
  ];
  headerRow(expenseSheet);
  for (const e of vm.expenseBreakdown) {
    expenseSheet.addRow({ category: e.category, amount: e.amount, pct: Math.round(e.pct) });
  }
  expenseSheet.getColumn("amount").numFmt = "#,##0";

  const pointSheet = workbook.addWorksheet("Пунктлар");
  pointSheet.columns = [
    { header: "Пункт", key: "point", width: 14 },
    { header: "Рейслар", key: "tripCount", width: 10 },
    { header: "Рейс тушуми", key: "tripIncome", width: 16 },
    { header: "Заказлар", key: "orderCount", width: 10 },
    { header: "Заказ тушуми", key: "orderIncome", width: 16 },
    { header: "Жами тушум", key: "totalIncome", width: 16 },
    { header: "Чиқим сони", key: "expenseCount", width: 12 },
    { header: "Чиқим суммаси", key: "expenseTotal", width: 16 },
  ];
  headerRow(pointSheet);
  for (const p of vm.pointBreakdown) {
    pointSheet.addRow({
      point: POINT_LABELS[p.point] ?? p.point,
      tripCount: p.tripCount,
      tripIncome: p.tripIncome,
      orderCount: p.orderCount,
      orderIncome: p.orderIncome,
      totalIncome: p.tripIncome + p.orderIncome,
      expenseCount: p.expenseCount,
      expenseTotal: p.expenseTotal,
    });
  }
  for (const key of ["tripIncome", "orderIncome", "totalIncome", "expenseTotal"]) {
    pointSheet.getColumn(key).numFmt = "#,##0";
  }

  const pointExpenseSheet = workbook.addWorksheet("Пункт харажатлари");
  pointExpenseSheet.columns = [
    { header: "Пункт", key: "point", width: 14 },
    { header: "Тоифа", key: "category", width: 26 },
    { header: "Сумма", key: "amount", width: 16 },
  ];
  headerRow(pointExpenseSheet);
  for (const p of vm.pointBreakdown) {
    for (const c of p.expenseByCategory) {
      pointExpenseSheet.addRow({ point: POINT_LABELS[p.point] ?? p.point, category: c.category, amount: c.amount });
    }
  }
  pointExpenseSheet.getColumn("amount").numFmt = "#,##0";

  const ordersSheet = workbook.addWorksheet("Заказлар");
  ordersSheet.columns = [
    { header: "Сана", key: "date", width: 12 },
    { header: "Вақт", key: "time", width: 10 },
    { header: "Пункт", key: "point", width: 12 },
    { header: "Машина", key: "plate", width: 14 },
    { header: "Ҳайдовчи", key: "driver", width: 24 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "Изоҳ", key: "note", width: 32 },
  ];
  headerRow(ordersSheet);
  for (const o of vm.orders) {
    ordersSheet.addRow({
      date: o.time.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TASHKENT_TZ }),
      time: o.time.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: TASHKENT_TZ }),
      point: POINT_LABELS[o.point] ?? o.point,
      plate: o.plate,
      driver: o.driverName,
      amount: o.amount,
      note: o.note ?? "",
    });
  }
  ordersSheet.getColumn("amount").numFmt = "#,##0";

  const vehiclesSheet = workbook.addWorksheet("Машиналар");
  vehiclesSheet.columns = [
    { header: "Машина", key: "plate", width: 14 },
    { header: "Ҳайдовчи", key: "driver", width: 24 },
    { header: "Рейслар", key: "trips", width: 10 },
    { header: "Заказ", key: "orders", width: 10 },
    { header: "Тушум", key: "income", width: 16 },
    { header: "Харажат", key: "expense", width: 16 },
    { header: "Фойда", key: "profit", width: 16 },
    { header: "Ҳолат", key: "status", width: 12 },
  ];
  headerRow(vehiclesSheet);
  for (const v of vm.vehicles) {
    vehiclesSheet.addRow({
      plate: v.plate,
      driver: v.driverName,
      trips: v.tripCount,
      orders: v.orderCount,
      income: v.income,
      expense: v.expense,
      profit: v.profit,
      status: v.status,
    });
  }
  const totalsRow = vehiclesSheet.addRow({
    plate: "ЖАМИ",
    trips: vm.vehicles.reduce((s, v) => s + v.tripCount, 0),
    orders: vm.vehicles.reduce((s, v) => s + v.orderCount, 0),
    income: vm.totalIncome,
    expense: vm.totalExpense,
    profit: vm.netProfit,
  });
  totalsRow.font = { bold: true };
  for (const key of ["income", "expense", "profit"]) {
    vehiclesSheet.getColumn(key).numFmt = "#,##0";
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hisobot_${dateStr}.xlsx"`,
    },
  });
}
