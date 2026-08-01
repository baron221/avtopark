import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/components/ui/RoleBadge";
import { uzMonthName } from "@/lib/format";
import { monthStart } from "@/lib/month";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const now = new Date();
  const month = monthStart(now);

  const [users, salaries, advances] = await Promise.all([
    prisma.user.findMany({ where: { role: { not: "OWNER" }, isActive: true }, orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
    prisma.salary.findMany({ where: { month } }),
    prisma.advance.findMany({ where: { month } }),
  ]);

  const salaryByUser = new Map(salaries.map((s) => [s.userId, s]));
  const advanceByUser = new Map<string, number>();
  for (const a of advances) {
    advanceByUser.set(a.userId, (advanceByUser.get(a.userId) ?? 0) + Number(a.amount));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = now;

  const sheet = workbook.addWorksheet(`Ведомост ${uzMonthName(now)} ${now.getFullYear()}`);
  sheet.columns = [
    { header: "Ходим", key: "name", width: 26 },
    { header: "Рол", key: "role", width: 16 },
    { header: "Маош", key: "salary", width: 14 },
    { header: "Аванс", key: "advance", width: 14 },
    { header: "Жарима", key: "fines", width: 14 },
    { header: "Обед", key: "lunch", width: 14 },
    { header: "Бонус", key: "bonus", width: 14 },
    { header: "Қўлга тегади", key: "net", width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

  for (const u of users) {
    const salary = salaryByUser.get(u.id);
    sheet.addRow({
      name: u.fullName,
      role: ROLE_LABELS[u.role],
      salary: Number(u.baseSalary ?? BigInt(0)),
      advance: advanceByUser.get(u.id) ?? 0,
      fines: Number(salary?.finesTotal ?? 0),
      lunch: Number(salary?.lunchTotal ?? 0),
      bonus: Number(salary?.bonus ?? 0),
      net: salary ? Number(salary.netPay) : null,
    });
  }

  for (const key of ["salary", "advance", "fines", "lunch", "bonus", "net"]) {
    sheet.getColumn(key).numFmt = "#,##0";
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vedomost_${month.getFullYear()}-${month.getMonth() + 1}.xlsx"`,
    },
  });
}
