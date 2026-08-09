import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/components/ui/RoleBadge";
import { uzMonthName } from "@/lib/format";
import { monthStart, monthEnd } from "@/lib/month";
import { computeDriverMonthlyPay } from "@/lib/driverPay";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const month =
    monthParam && MONTH_RE.test(monthParam)
      ? new Date(Date.UTC(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1))
      : monthStart(new Date());

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

  // A driver's base salary is computed from daily trip revenue (see
  // driverPay.ts) — computed live so the export is accurate even before
  // "Ведомостни яратиш" has been run this month.
  const driverRecords = await prisma.driver.findMany({
    where: { userId: { in: users.filter((u) => u.role === "DRIVER").map((u) => u.id) } },
  });
  const driverPayByUserId = new Map<string, bigint>();
  await Promise.all(
    driverRecords.map(async (d) => {
      driverPayByUserId.set(d.userId, (await computeDriverMonthlyPay(d.id, month, monthEnd(month))).total);
    })
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avtopark Foyda Tizimi";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Ведомост ${uzMonthName(month)} ${month.getUTCFullYear()}`);
  sheet.columns = [
    { header: "Ходим", key: "name", width: 26 },
    { header: "Рол", key: "role", width: 16 },
    { header: "Маош", key: "salary", width: 14 },
    { header: "Аванс", key: "advance", width: 14 },
    { header: "Жарима", key: "fines", width: 14 },
    { header: "Бонус", key: "bonus", width: 14 },
    { header: "Қўлга тегади", key: "net", width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

  let salaryTotal = 0;
  let advanceTotal = 0;
  let finesTotal = 0;
  let bonusTotal = 0;
  let netTotal = 0;

  for (const u of users) {
    const salary = salaryByUser.get(u.id);
    // Prefer the stored (generated) figure once it exists; for a driver
    // without one yet, fall back to the live daily-tariff computation
    // rather than the now-vestigial flat rate.
    const salaryAmount = Number(salary?.baseSalary ?? driverPayByUserId.get(u.id) ?? u.baseSalary ?? BigInt(0));
    const advanceAmount = advanceByUser.get(u.id) ?? 0;
    const finesAmount = Number(salary?.finesTotal ?? 0);
    const bonusAmount = Number(salary?.bonus ?? 0);
    const netAmount = salary ? Number(salary.netPay) : 0;

    salaryTotal += salaryAmount;
    advanceTotal += advanceAmount;
    finesTotal += finesAmount;
    bonusTotal += bonusAmount;
    netTotal += netAmount;

    sheet.addRow({
      name: u.fullName,
      role: ROLE_LABELS[u.role],
      salary: salaryAmount,
      advance: advanceAmount,
      fines: finesAmount,
      bonus: bonusAmount,
      net: salary ? netAmount : null,
    });
  }

  const totalsRow = sheet.addRow({
    name: "ЖАМИ",
    salary: salaryTotal,
    advance: advanceTotal,
    fines: finesTotal,
    bonus: bonusTotal,
    net: netTotal,
  });
  totalsRow.font = { bold: true };

  for (const key of ["salary", "advance", "fines", "bonus", "net"]) {
    sheet.getColumn(key).numFmt = "#,##0";
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vedomost_${month.getUTCFullYear()}-${month.getUTCMonth() + 1}.xlsx"`,
    },
  });
}
