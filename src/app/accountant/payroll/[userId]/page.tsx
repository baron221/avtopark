import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { formatSom, uzMonthName } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";
import { getDailyPayBreakdown } from "@/lib/driverPay";
import { computeNetPay } from "@/lib/payroll";

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonthParam(value: string | undefined): Date {
  if (value && MONTH_RE.test(value)) {
    const [y, m] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, 1));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return monthStart(new Date());
}

export default async function PayrollDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { userId } = await params;
  const { month: monthParam } = await searchParams;
  const month = parseMonthParam(monthParam);
  const monthStr = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  const from = month;
  const to = monthEnd(month);

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { driver: true } });
  if (!user || user.role === "OWNER") notFound();

  const [advances, fines, salary] = await Promise.all([
    prisma.advance.findMany({ where: { userId, month }, orderBy: { givenDate: "asc" } }),
    prisma.fine.findMany({ where: { userId, fineDate: { gte: from, lte: to } }, orderBy: { fineDate: "asc" } }),
    prisma.salary.findUnique({ where: { userId_month: { userId, month } } }),
  ]);

  const dailyPay = user.driver ? await getDailyPayBreakdown(user.driver.id, from, to) : [];

  const baseSalary = user.driver
    ? BigInt(dailyPay.reduce((s, r) => s + r.pay, 0))
    : (salary?.baseSalary ?? user.baseSalary ?? BigInt(0));
  const bonus = salary?.bonus ?? BigInt(0);
  const advancesTotal = advances.reduce((s, a) => s + a.amount, BigInt(0));
  const finesTotal = fines.filter((f) => f.deducted).reduce((s, f) => s + f.amount, BigInt(0));
  const netPay = computeNetPay({ baseSalary, bonus, advancesTotal, finesTotal });

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading flex items-center gap-2.5 flex-wrap">
            {user.fullName} <RoleBadge role={user.role} point={user.point} />
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {uzMonthName(month)} {month.getUTCFullYear()} · батафсил ҳисоб-китоб
          </div>
        </div>
        <Link
          href={`/accountant/payroll?month=${monthStr}`}
          className="bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
        >
          ← Ведомост
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Маош" value={formatSom(Number(baseSalary))} />
        <KpiCard label="Бонус" value={`+${formatSom(Number(bonus))}`} hintColor="success" />
        <KpiCard label="Аванс" value={`−${formatSom(Number(advancesTotal))}`} />
        <KpiCard label="Жарима" value={`−${formatSom(Number(finesTotal))}`} hintColor="danger" />
        <KpiCard variant="primary" label="Қўлга тегади" value={formatSom(Number(netPay))} />
      </div>

      {user.driver && (
        <Card className="overflow-hidden">
          <div className="px-6 py-[18px] font-heading font-bold text-base text-heading">Кунлик тушум ва маош</div>
          <div className="grid grid-cols-3 px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
            <div>Сана</div>
            <div>Тушум</div>
            <div>Ажратилган пул</div>
          </div>
          {dailyPay.map((r) => (
            <div key={r.date} className="grid grid-cols-3 px-6 py-3 border-t border-row-divider items-center text-sm">
              <div className="text-muted-2 font-bold">{r.date}</div>
              <div className="font-semibold text-body">{formatSom(r.revenue)}</div>
              <div className="font-extrabold text-heading">{formatSom(r.pay)}</div>
            </div>
          ))}
          {dailyPay.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу ойда рейс ёзилмаган</p>}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-[18px] font-heading font-bold text-base text-heading">Аванслар</div>
        <div className="grid grid-cols-2 px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Сана</div>
          <div>Сумма</div>
        </div>
        {advances.map((a) => (
          <div key={a.id} className="grid grid-cols-2 px-6 py-3 border-t border-row-divider items-center text-sm">
            <div className="text-muted-2 font-bold">{a.givenDate.toISOString().slice(0, 10)}</div>
            <div className="font-extrabold text-primary">−{formatSom(Number(a.amount))}</div>
          </div>
        ))}
        {advances.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу ойда аванс йўқ</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-[18px] font-heading font-bold text-base text-heading">Жарималар</div>
        <div className="grid grid-cols-[0.8fr_1.6fr_0.8fr_0.6fr] px-6 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Сана</div>
          <div>Сабаб</div>
          <div>Сумма</div>
          <div>Ушланди</div>
        </div>
        {fines.map((f) => (
          <div
            key={f.id}
            className="grid grid-cols-[0.8fr_1.6fr_0.8fr_0.6fr] px-6 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="text-muted-2 font-bold">{f.fineDate.toISOString().slice(0, 10)}</div>
            <div className="text-body font-semibold">{f.reason}</div>
            <div className="font-extrabold text-danger">−{formatSom(Number(f.amount))}</div>
            <div className="text-xs font-bold">{f.deducted ? "Ҳа" : "Йўқ"}</div>
          </div>
        ))}
        {fines.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу ойда жарима йўқ</p>}
      </Card>
    </div>
  );
}
