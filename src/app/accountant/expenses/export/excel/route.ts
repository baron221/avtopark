import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";
import { uzMonthName } from "@/lib/format";

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

export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL")))) {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const now = new Date();
  const from = monthStart(now);
  const to = monthEnd(now);

  const [expenses, users] = await Promise.all([
    prisma.staffExpense.findMany({ where: { expenseDate: { gte: from, lte: to } }, orderBy: { expenseDate: "asc" } }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = now;

  const sheet = workbook.addWorksheet(`Расходлар ${uzMonthName(now)} ${now.getFullYear()}`);
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

  for (const e of expenses) {
    sheet.addRow({
      date: e.expenseDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" }),
      name: nameById.get(e.userId) ?? "—",
      point: POINT_LABELS[e.point] ?? e.point,
      category: CATEGORY_LABELS[e.category] ?? e.category,
      note: e.note ?? "",
      amount: Number(e.amount),
    });
  }
  const totalsRow = sheet.addRow({ name: "ЖАМИ", amount: expenses.reduce((s, e) => s + Number(e.amount), 0) });
  totalsRow.font = { bold: true };
  sheet.getColumn("amount").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rasxodlar_${now.getFullYear()}-${now.getMonth() + 1}.xlsx"`,
    },
  });
}
