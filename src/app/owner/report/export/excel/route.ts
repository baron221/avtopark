import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOwnerDashboardVM, getMonthlyTrend } from "@/lib/dashboard";
import { uzMonthName } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";

const INCOME_LABELS: Record<string, string> = {
  TRIPS: "Рейс тушуми",
  RENTAL: "Ойлик ижара",
  PLAN: "Кунлик план",
};

export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const now = new Date();
  const [vm, trend] = await Promise.all([getOwnerDashboardVM("MONTH"), getMonthlyTrend(6)]);

  const incomeByCategory: Record<string, number> = { TRIPS: 0, RENTAL: 0, PLAN: 0 };
  for (const v of vm.vehicles) incomeByCategory[v.incomeSource] += v.income;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = now;

  const summarySheet = workbook.addWorksheet("Хулоса");
  summarySheet.columns = [
    { header: "Кўрсаткич", key: "label", width: 30 },
    { header: "Қиймат (сўм)", key: "value", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  summarySheet.addRows([
    { label: "Жами тушум", value: vm.totalIncome },
    { label: "Жами харажат", value: vm.totalExpense },
    { label: "Соф фойда", value: vm.netProfit },
    { label: "Машиналар сони", value: vm.vehicleCount },
    { label: "Ҳайдовчилар сони", value: vm.driverCount },
  ]);
  summarySheet.getColumn("value").numFmt = "#,##0";

  const incomeSheet = workbook.addWorksheet("Даромад манбалари");
  incomeSheet.columns = [
    { header: "Манба", key: "name", width: 24 },
    { header: "Сумма (сўм)", key: "amount", width: 18 },
    { header: "Улуш (%)", key: "pct", width: 12 },
  ];
  incomeSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  incomeSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const [key, amount] of Object.entries(incomeByCategory)) {
    if (amount <= 0) continue;
    incomeSheet.addRow({
      name: INCOME_LABELS[key] ?? key,
      amount,
      pct: vm.totalIncome > 0 ? Math.round((amount / vm.totalIncome) * 100) : 0,
    });
  }
  incomeSheet.getColumn("amount").numFmt = "#,##0";

  const expenseSheet = workbook.addWorksheet("Харажат тоифалари");
  expenseSheet.columns = [
    { header: "Тоифа", key: "category", width: 24 },
    { header: "Сумма (сўм)", key: "amount", width: 18 },
    { header: "Улуш (%)", key: "pct", width: 12 },
  ];
  expenseSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  expenseSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const e of vm.expenseBreakdown) {
    expenseSheet.addRow({ category: e.category, amount: e.amount, pct: Math.round(e.pct) });
  }
  expenseSheet.getColumn("amount").numFmt = "#,##0";

  const trendSheet = workbook.addWorksheet("6 ойлик тренд");
  trendSheet.columns = [
    { header: "Ой", key: "label", width: 14 },
    { header: "Тушум", key: "income", width: 16 },
    { header: "Харажат", key: "expense", width: 16 },
    { header: "Фойда", key: "profit", width: 16 },
  ];
  trendSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  trendSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const t of trend) {
    trendSheet.addRow(t);
  }
  for (const key of ["income", "expense", "profit"]) {
    trendSheet.getColumn(key).numFmt = "#,##0";
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hisobot_${uzMonthName(now)}_${now.getFullYear()}.xlsx"`,
    },
  });
}
