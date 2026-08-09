import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/components/ui/RoleBadge";
import { uzMonthName } from "@/lib/format";
import { monthStart, monthEnd } from "@/lib/month";
import { getDailyPayBreakdown, type DailyPayRow } from "@/lib/driverPay";
import { computeNetPay } from "@/lib/payroll";

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
  const isCurrentMonth = month.getTime() === monthStart(new Date()).getTime();
  const from = month;
  const to = monthEnd(month);

  const [users, salaries, advances, fines] = await Promise.all([
    prisma.user.findMany({ where: { role: { not: "OWNER" }, isActive: true }, orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
    prisma.salary.findMany({ where: { month } }),
    prisma.advance.findMany({ where: { month }, orderBy: { givenDate: "asc" } }),
    prisma.fine.findMany({ where: { fineDate: { gte: from, lte: to } }, orderBy: { fineDate: "asc" } }),
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const salaryByUser = new Map(salaries.map((s) => [s.userId, s]));
  const advanceByUser = new Map<string, number>();
  for (const a of advances) {
    advanceByUser.set(a.userId, (advanceByUser.get(a.userId) ?? 0) + Number(a.amount));
  }

  // A driver's base salary is computed from daily trip revenue (see
  // driverPay.ts) — computed live so the export is accurate even before
  // "Ведомостни яратиш" has been run this month; the per-day breakdown also
  // feeds the "Кунлик тафсилот" sheet below.
  const driverRecords = await prisma.driver.findMany({
    where: { userId: { in: users.filter((u) => u.role === "DRIVER").map((u) => u.id) } },
  });
  const dailyPayByUserId = new Map<string, DailyPayRow[]>();
  await Promise.all(
    driverRecords.map(async (d) => {
      dailyPayByUserId.set(d.userId, await getDailyPayBreakdown(d.id, from, to));
    })
  );
  const driverPayByUserId = new Map<string, bigint>(
    [...dailyPayByUserId].map(([userId, rows]) => [userId, BigInt(rows.reduce((s, r) => s + r.pay, 0))])
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
    const advanceAmount = advanceByUser.get(u.id) ?? 0;
    // A driver's base salary keeps accruing trip-by-trip all month, so while
    // the month is still ongoing it's always the live daily-tariff total —
    // never the stale figure frozen at whatever it was when "Тасдиқлаш" was
    // clicked. Past months keep the stored (settled) snapshot as-is.
    const isDriverLive = u.role === "DRIVER" && isCurrentMonth;
    const salaryAmount = isDriverLive
      ? Number(driverPayByUserId.get(u.id) ?? 0)
      : Number(salary?.baseSalary ?? driverPayByUserId.get(u.id) ?? u.baseSalary ?? BigInt(0));
    const finesAmount = Number(salary?.finesTotal ?? 0);
    const bonusAmount = Number(salary?.bonus ?? 0);
    const netAmount = isDriverLive
      ? Number(
          computeNetPay({
            baseSalary: salaryAmount,
            bonus: salary?.bonus ?? BigInt(0),
            advancesTotal: advanceAmount,
            finesTotal: salary?.finesTotal ?? BigInt(0),
          })
        )
      : salary
        ? Number(salary.netPay)
        : 0;

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
      net: salary || isDriverLive ? netAmount : null,
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

  const dailySheet = workbook.addWorksheet("Кунлик тафсилот");
  dailySheet.columns = [
    { header: "Ходим", key: "name", width: 26 },
    { header: "Сана", key: "date", width: 14 },
    { header: "Кунлик тушум", key: "revenue", width: 16 },
    { header: "Ажратилган пул", key: "pay", width: 16 },
  ];
  dailySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  dailySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const u of users) {
    for (const r of dailyPayByUserId.get(u.id) ?? []) {
      dailySheet.addRow({ name: u.fullName, date: r.date, revenue: r.revenue, pay: r.pay });
    }
  }
  for (const key of ["revenue", "pay"]) {
    dailySheet.getColumn(key).numFmt = "#,##0";
  }

  const advancesSheet = workbook.addWorksheet("Аванслар");
  advancesSheet.columns = [
    { header: "Ходим", key: "name", width: 26 },
    { header: "Сана", key: "date", width: 14 },
    { header: "Сумма", key: "amount", width: 16 },
  ];
  advancesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  advancesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const a of advances) {
    const u = usersById.get(a.userId);
    if (!u) continue;
    advancesSheet.addRow({
      name: u.fullName,
      date: a.givenDate.toISOString().slice(0, 10),
      amount: Number(a.amount),
    });
  }
  advancesSheet.getColumn("amount").numFmt = "#,##0";

  const finesSheet = workbook.addWorksheet("Жарималар");
  finesSheet.columns = [
    { header: "Ходим", key: "name", width: 26 },
    { header: "Сана", key: "date", width: 14 },
    { header: "Сабаб", key: "reason", width: 32 },
    { header: "Сумма", key: "amount", width: 16 },
    { header: "Ушланди", key: "deducted", width: 12 },
  ];
  finesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  finesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  for (const f of fines) {
    const u = usersById.get(f.userId);
    if (!u) continue;
    finesSheet.addRow({
      name: u.fullName,
      date: f.fineDate.toISOString().slice(0, 10),
      reason: f.reason,
      amount: Number(f.amount),
      deducted: f.deducted ? "Ҳа" : "Йўқ",
    });
  }
  finesSheet.getColumn("amount").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vedomost_${month.getUTCFullYear()}-${month.getUTCMonth() + 1}.xlsx"`,
    },
  });
}
