import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { formatSom, uzMonthName } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";

const INCOME_LABELS: Record<string, string> = {
  TRIPS: "Reys tushumi",
  RENTAL: "Oylik ijara",
  PLAN: "Kunlik plan",
};

const INDIGO = rgb(0.31, 0.27, 0.9);
const HEADING = rgb(0.12, 0.12, 0.17);
const MUTED = rgb(0.42, 0.42, 0.5);

export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && !(await hasModuleAccess(session.user.role, "FLEET_DASHBOARD")))) {
    return NextResponse.json({ error: "Рухсат йўқ" }, { status: 403 });
  }

  const now = new Date();
  const vm = await getOwnerDashboardVM("MONTH");

  const incomeByCategory: Record<string, number> = { TRIPS: 0, RENTAL: 0, PLAN: 0 };
  for (const v of vm.vehicles) incomeByCategory[v.incomeSource] += v.income;
  const margin = vm.totalIncome > 0 ? (vm.netProfit / vm.totalIncome) * 100 : 0;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  const left = 50;

  const title = (text: string, size = 20) => {
    page.drawText(text, { x: left, y, size, font: bold, color: HEADING });
    y -= size + 10;
  };
  const subtitle = (text: string) => {
    page.drawText(text, { x: left, y, size: 11, font, color: MUTED });
    y -= 26;
  };
  const sectionHeading = (text: string) => {
    y -= 10;
    page.drawText(text, { x: left, y, size: 14, font: bold, color: HEADING });
    y -= 20;
  };
  const line = (label: string, value: string, valueColor = HEADING) => {
    page.drawText(label, { x: left, y, size: 12, font, color: MUTED });
    page.drawText(value, { x: 350, y, size: 12, font: bold, color: valueColor });
    y -= 20;
  };

  title(`Oylik hisobot · ${uzMonthName(now)} ${now.getFullYear()}`);
  subtitle(`${vm.vehicleCount} mashina · ${vm.driverCount} haydovchi`);

  sectionHeading("Asosiy ko'rsatkichlar");
  line("Jami tushum", `${formatSom(vm.totalIncome)} so'm`);
  line("Jami xarajat", `${formatSom(vm.totalExpense)} so'm`, rgb(0.85, 0.33, 0.31));
  line("Sof foyda", `${formatSom(vm.netProfit)} so'm`, INDIGO);
  line("Rentabellik", `${margin.toFixed(0)}%`);

  sectionHeading("Daromad manbalari");
  for (const [key, amount] of Object.entries(incomeByCategory)) {
    if (amount <= 0) continue;
    const pct = vm.totalIncome > 0 ? Math.round((amount / vm.totalIncome) * 100) : 0;
    line(INCOME_LABELS[key] ?? key, `${formatSom(amount)} so'm · ${pct}%`);
  }

  sectionHeading("Xarajat toifalari");
  for (const e of vm.expenseBreakdown) {
    line(e.category, `${formatSom(e.amount)} so'm · ${e.pct.toFixed(0)}%`);
  }

  const bytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hisobot_${uzMonthName(now)}_${now.getFullYear()}.pdf"`,
    },
  });
}
