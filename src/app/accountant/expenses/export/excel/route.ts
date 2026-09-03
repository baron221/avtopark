import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { rangeForPeriod, type Period } from "@/lib/dashboard";
import type { Point, StaffExpensePoint } from "@prisma/client";

const POINT_LABELS: Record<string, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
  YOLDA: "Йўлда",
  ISHXONA: "Ишхона",
  VEHICLE: "Машина",
};

const CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  OBED: "Обед",
  BOSHQA: "Бошқа",
};

const VEHICLE_CATEGORY_LABELS: Record<string, string> = {
  FUEL: "Ёқилғи",
  REPAIR: "Таъмирлаш",
  SALARY: "Маош",
  INSURANCE: "Суғурта",
  TAX: "Солиқ",
  TOLL: "Йўл ҳақи",
  OTHER: "Бошқа",
};

type ExpenseFilter = StaffExpensePoint | "VEHICLE";

function isPeriod(value: string | null): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isExpenseFilter(value: string | null): value is ExpenseFilter {
  return value === "FARGONA" || value === "QUVA" || value === "YOLDA" || value === "ISHXONA" || value === "VEHICLE";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");
  const dateParam = searchParams.get("date");
  const pointParam = searchParams.get("point");

  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const date = dateParam && DATE_RE.test(dateParam) ? new Date(`${dateParam}T00:00:00Z`) : new Date();
  const point = isExpenseFilter(pointParam) ? pointParam : undefined;
  const { from, to } = rangeForPeriod(period, date);

  // See page.tsx's comment: Lunch (Обед) and the generic vehicle Expense
  // (mechanic-entered) are separate models from StaffExpense, so they have
  // to be fetched and merged in separately or the export total would be
  // missing whatever this page shows on screen for "Барчаси".
  const staffPoint: StaffExpensePoint | undefined = point && point !== "VEHICLE" ? point : undefined;
  const lunchPoint: Point | undefined = point === "FARGONA" || point === "QUVA" ? point : undefined;
  const includeLunch = point === undefined || point === "FARGONA" || point === "QUVA";
  const includeVehicleExpense = point === undefined || point === "VEHICLE";
  const includeStaffExpense = point !== "VEHICLE";

  const [staffExpenses, lunches, vehicleExpenses, users] = await Promise.all([
    includeStaffExpense
      ? prisma.staffExpense.findMany({
          where: { expenseDate: { gte: from, lte: to }, ...(staffPoint ? { point: staffPoint } : {}) },
          orderBy: { expenseDate: "asc" },
        })
      : Promise.resolve([]),
    includeLunch
      ? prisma.lunch.findMany({
          where: { lunchDate: { gte: from, lte: to }, ...(lunchPoint ? { point: lunchPoint } : {}) },
          include: { user: true },
          orderBy: { lunchDate: "asc" },
        })
      : Promise.resolve([]),
    includeVehicleExpense
      ? prisma.expense.findMany({
          where: { expenseDate: { gte: from, lte: to } },
          include: { vehicle: true },
          orderBy: { expenseDate: "asc" },
        })
      : Promise.resolve([]),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  const rows = [
    ...staffExpenses.map((e) => ({
      time: e.expenseDate,
      name: nameById.get(e.userId) ?? "—",
      point: e.point as string,
      category: CATEGORY_LABELS[e.category] ?? e.category,
      note: e.note,
      amount: Number(e.amount),
    })),
    ...vehicleExpenses.map((e) => ({
      time: e.expenseDate,
      name: e.vehicle.plate,
      point: "VEHICLE",
      category: VEHICLE_CATEGORY_LABELS[e.category] ?? e.category,
      note: e.note,
      amount: Number(e.amount),
    })),
    ...lunches.map((l) => ({
      // Not l.lunchDate — see Lunch's own schema comment, it's always UTC
      // midnight (the per-day unique key), not when this was logged.
      time: l.createdAt,
      name: l.user.fullName,
      point: l.point as string,
      category: "Обед",
      note: "Тушлик",
      amount: Number(l.amount),
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = new Date();

  const rangeLabel = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
  const sheet = workbook.addWorksheet(`Расходлар ${rangeLabel}`);
  sheet.columns = [
    { header: "Сана", key: "date", width: 12 },
    { header: "Ходим", key: "name", width: 24 },
    { header: "Пункт", key: "point", width: 12 },
    { header: "Тоифа", key: "category", width: 16 },
    { header: "Изоҳ", key: "note", width: 30 },
    { header: "Сумма", key: "amount", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

  for (const r of rows) {
    sheet.addRow({
      date: r.time.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" }),
      name: r.name,
      point: POINT_LABELS[r.point] ?? r.point,
      category: r.category,
      note: r.note ?? "",
      amount: r.amount,
    });
  }
  const totalsRow = sheet.addRow({ name: "ЖАМИ", amount: rows.reduce((s, r) => s + r.amount, 0) });
  totalsRow.font = { bold: true };
  sheet.getColumn("amount").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rasxodlar_${rangeLabel}.xlsx"`,
    },
  });
}
