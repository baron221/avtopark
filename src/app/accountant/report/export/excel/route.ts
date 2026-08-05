import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOwnerDashboardVM, type Period } from "@/lib/dashboard";
import { hasModuleAccess } from "@/lib/access";

const PERIOD_LABELS: Record<Period, string> = { DAY: "Кунлик", WEEK: "Ҳафталик", MONTH: "Ойлик" };

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
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
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

  const vehiclesSheet = workbook.addWorksheet("Машиналар");
  vehiclesSheet.columns = [
    { header: "Машина", key: "plate", width: 14 },
    { header: "Ҳайдовчи", key: "driver", width: 24 },
    { header: "Рейслар", key: "trips", width: 10 },
    { header: "Тушум", key: "income", width: 16 },
    { header: "Харажат", key: "expense", width: 16 },
    { header: "Фойда", key: "profit", width: 16 },
    { header: "Ҳолат", key: "status", width: 12 },
  ];
  vehiclesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  vehiclesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const v of vm.vehicles) {
    vehiclesSheet.addRow({
      plate: v.plate,
      driver: v.driverName,
      trips: v.tripCount,
      income: v.income,
      expense: v.expense,
      profit: v.profit,
      status: v.status,
    });
  }
  const totalsRow = vehiclesSheet.addRow({
    plate: "ЖАМИ",
    trips: vm.vehicles.reduce((s, v) => s + v.tripCount, 0),
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
