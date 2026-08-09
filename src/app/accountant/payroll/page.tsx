import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Pagination } from "@/components/ui/Pagination";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom, formatMillions, uzMonthName } from "@/lib/format";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";
import { computeDriverMonthlyPay } from "@/lib/driverPay";
import { computeNetPay } from "@/lib/payroll";
import { PayrollRow } from "./PayrollRow";
import { generatePayrollAction, approvePayrollAction } from "./actions";

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonthParam(value: string | undefined): Date {
  if (value && MONTH_RE.test(value)) {
    const [y, m] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, 1));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return monthStart(new Date());
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { page: pageParam, month: monthParam } = await searchParams;
  const page = parsePage(pageParam);

  const now = new Date();
  const month = parseMonthParam(monthParam);
  const isCurrentMonth = month.getTime() === monthStart(now).getTime();
  const monthStr = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  // "Month to date" for the current month (can't show days that haven't
  // happened yet); the full completed month when looking at the past.
  const vmReferenceDate = isCurrentMonth ? now : monthEnd(month);

  const [allUsers, salaries, advances, fines, fleetVM] = await Promise.all([
    prisma.user.findMany({ where: { role: { not: "OWNER" }, isActive: true }, orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
    prisma.salary.findMany({ where: { month } }),
    prisma.advance.findMany({ where: { month } }),
    prisma.fine.findMany({ where: { deducted: true, fineDate: { gte: month, lte: monthEnd(month) } } }),
    getOwnerDashboardVM("MONTH", vmReferenceDate),
  ]);

  const skip = paginationSkip(page);
  const users = allUsers.slice(skip, skip + DEFAULT_PAGE_SIZE);
  const pages = totalPages(allUsers.length);
  const todayStr = new Date().toISOString().slice(0, 10);

  const salaryByUser = new Map(salaries.map((s) => [s.userId, s]));
  const advanceByUser = new Map<string, number>();
  for (const a of advances) {
    advanceByUser.set(a.userId, (advanceByUser.get(a.userId) ?? 0) + Number(a.amount));
  }
  // Fines, like advances, are always live-queried from their own table
  // rather than a possibly-not-yet-generated Salary row's frozen snapshot.
  const finesByUser = new Map<string, number>();
  for (const f of fines) {
    finesByUser.set(f.userId, (finesByUser.get(f.userId) ?? 0) + Number(f.amount));
  }

  // A driver's base salary is computed from their daily trip revenue (see
  // driverPay.ts), not the flat admin-set rate — computed live here (over
  // every driver, not just this page's slice, since salaryFund below sums
  // the whole list) so it's accurate even before "Ведомостни яратиш" has
  // been run this month.
  const driverRecords = await prisma.driver.findMany({
    where: { userId: { in: allUsers.filter((u) => u.role === "DRIVER").map((u) => u.id) } },
  });
  const driverPayByUserId = new Map<string, { total: bigint; dayCount: number }>();
  await Promise.all(
    driverRecords.map(async (d) => {
      driverPayByUserId.set(d.userId, await computeDriverMonthlyPay(d.id, month, monthEnd(month)));
    })
  );

  // A driver's base salary keeps accruing trip-by-trip all month, with no
  // other source of truth, so it's always live. A non-driver's flat rate
  // only changes via an explicit edit (admin panel or "Таҳрирлаш" below),
  // and every edit action here re-syncs the Salary row's baseSalary to
  // match — so the settled Salary figure (once one exists) is trusted over
  // User.baseSalary, which isn't reliably kept in sync on its own and can
  // otherwise show a stale or blank rate. Advances/fines are always live
  // (their own always-current tables) once the month is still ongoing;
  // only Бонус has no live source, so it reads the stored row or else 0.
  // A past month keeps its fully settled, frozen snapshot as the record.
  function effectivePay(u: (typeof allUsers)[number]) {
    const salary = salaryByUser.get(u.id);
    const advance = advanceByUser.get(u.id) ?? 0;
    const fines = finesByUser.get(u.id) ?? 0;
    const bonus = salary?.bonus ?? BigInt(0);

    const baseSalary =
      u.role === "DRIVER" && isCurrentMonth
        ? (driverPayByUserId.get(u.id)?.total ?? BigInt(0))
        : (salary?.baseSalary ?? driverPayByUserId.get(u.id)?.total ?? u.baseSalary ?? BigInt(0));

    if (isCurrentMonth) {
      const netPay = computeNetPay({
        baseSalary,
        bonus,
        advancesTotal: BigInt(advance),
        finesTotal: BigInt(fines),
      });
      return { baseSalary, bonus, fines, netPay, netPayKnown: true };
    }
    return {
      baseSalary,
      bonus,
      fines: Number(salary?.finesTotal ?? 0),
      netPay: salary?.netPay ?? BigInt(0),
      netPayKnown: !!salary,
    };
  }

  const payByUserId = new Map(allUsers.map((u) => [u.id, effectivePay(u)]));

  const salaryFund = allUsers.reduce((s, u) => s + Number(payByUserId.get(u.id)!.baseSalary), 0);
  const advancesTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const finesTotal = allUsers.reduce((s, u) => s + Number(payByUserId.get(u.id)!.fines), 0);
  const bonusTotal = allUsers.reduce((s, u) => s + Number(payByUserId.get(u.id)!.bonus), 0);
  const netPayTotal = allUsers.reduce((s, u) => s + Number(payByUserId.get(u.id)!.netPay), 0);
  // Advances are a pre-payment of the very same base salary (already inside
  // salaryFund) that gets clawed back at settlement, so it nets out —
  // including it here on top of salaryFund would double-count it. A fine
  // reduces what the company actually pays out, so it's added back rather
  // than subtracted again. Lunch is no longer a payroll deduction — it's a
  // general expense, already counted inside fleetVM.netProfit.
  const netProfitAfterAll = fleetVM.netProfit - (salaryFund + bonusTotal - finesTotal);

  const allApproved = salaries.length > 0 && salaries.every((s) => s.status !== "DRAFT");

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Ойлик ҳисоб-китоб · {uzMonthName(month)} {month.getUTCFullYear()}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Маош + бонус − аванс − жарима = қўлга тегади
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <MonthPicker basePath="/accountant/payroll" value={monthStr} />
          {isCurrentMonth && (
            <form action={generatePayrollAction}>
              <button type="submit" className="bg-primary-tint text-primary rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]">
                Ведомостни яратиш/янгилаш
              </button>
            </form>
          )}
          <Link
            href={`/accountant/payroll/export?month=${monthStr}`}
            className="bg-card border border-border text-body rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]"
          >
            ⬇ Ведомост (Excel)
          </Link>
          {isCurrentMonth && (
            <form action={approvePayrollAction}>
              <button
                type="submit"
                disabled={salaries.length === 0 || allApproved}
                className="bg-primary text-white rounded-[10px] px-4 py-2.5 font-extrabold text-[13px] disabled:opacity-50"
              >
                Тўловни тасдиқлаш
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Жами маош фонди" value={formatMillions(salaryFund)} />
        <KpiCard label="Берилган аванслар" value={`−${formatMillions(advancesTotal)}`} />
        <KpiCard label="Жарималар (ушлаб қолинади)" value={`−${formatMillions(finesTotal)}`} hintColor="danger" />
        <KpiCard variant="primary" label="Соф фойда (барча ҳисобдан кейин)" value={formatMillions(netProfitAfterAll)} />
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.3fr_0.9fr_0.85fr_0.8fr_0.75fr_0.9fr_1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Ходим</div>
          <div>Рол</div>
          <div>Маош</div>
          <div>Аванс</div>
          <div>Жарима</div>
          <div>Бонус</div>
          <div>Қўлга тегади</div>
        </div>
        {users.map((u) => {
          const advance = advanceByUser.get(u.id) ?? 0;
          const pay = payByUserId.get(u.id)!;
          return (
            <PayrollRow
              key={u.id}
              user={{ id: u.id, fullName: u.fullName, role: u.role, point: u.point }}
              baseSalary={Number(pay.baseSalary)}
              bonus={Number(pay.bonus)}
              fines={pay.fines}
              advance={advance}
              netPay={Number(pay.netPay)}
              netPayKnown={pay.netPayKnown}
              dayCount={driverPayByUserId.get(u.id)?.dayCount}
              monthStr={monthStr}
              isCurrentMonth={isCurrentMonth}
              detailHref={`/accountant/payroll/${u.id}?month=${monthStr}`}
              today={todayStr}
            />
          );
        })}
        {users.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ходим топилмади</p>}
        <div className="grid grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.85fr_0.8fr_0.75fr_0.9fr_1fr] gap-y-1.5 gap-x-2 px-6 py-3.5 border-t-2 border-primary bg-primary-tint items-center text-sm">
          <div className="font-extrabold text-heading col-span-2 lg:col-span-1">Жами ({allUsers.length} ходим)</div>
          <div></div>
          <div className="font-extrabold text-heading">{formatSom(salaryFund)}</div>
          <div className="font-extrabold text-primary">−{formatSom(advancesTotal)}</div>
          <div className="font-extrabold text-danger">−{formatSom(finesTotal)}</div>
          <div className="font-extrabold text-success">+{formatSom(bonusTotal)}</div>
          <div className="font-heading font-extrabold text-heading">{formatSom(netPayTotal)}</div>
        </div>
        <Pagination page={page} totalPages={pages} basePath="/accountant/payroll" params={{ month: monthStr }} />
      </Card>
    </div>
  );
}
