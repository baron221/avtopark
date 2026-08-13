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
};

const CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  OBED: "Обед",
  BOSHQA: "Бошқа",
};

function isPeriod(value: string | null): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isStaffExpensePoint(value: string | null): value is StaffExpensePoint {
  return value === "FARGONA" || value === "QUVA" || value === "YOLDA" || value === "ISHXONA";
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
  const point = isStaffExpensePoint(pointParam) ? pointParam : undefined;
  const { from, to } = rangeForPeriod(period, date);

  // See page.tsx's comment: Lunch (Обед) is a separate model from
  // StaffExpense, so it has to be fetched and merged in separately.
  const lunchPoint: Point | undefined = point === "FARGONA" || point === "QUVA" ? point : undefined;
  const includeLunch = point !== "YOLDA" && point !== "ISHXONA";

  const [staffExpenses, lunches, users] = await Promise.all([
    prisma.staffExpense.findMany({
      where: { expenseDate: { gte: from, lte: to }, ...(point ? { point } : {}) },
      orderBy: { expenseDate: "asc" },
    }),
    includeLunch
      ? prisma.lunch.findMany({
          where: { lunchDate: { gte: from, lte: to }, ...(lunchPoint ? { point: lunchPoint } : {}) },
          include: { user: true },
          orderBy: { lunchDate: "asc" },
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
    ...lunches.map((l) => ({
      time: l.lunchDate,
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
