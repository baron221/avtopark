import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Pagination } from "@/components/ui/Pagination";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom, formatMillions, uzMonthName } from "@/lib/format";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";
import { computeDriverMonthlyPay } from "@/lib/driverPay";
import { computeNetPay } from "@/lib/payroll";
import { PayrollRowLink } from "./PayrollRowLink";
import { generatePayrollAction, approvePayrollAction, setBonusAction, revertSalaryToDraftAction } from "./actions";

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

  const [allUsers, salaries, advances, fleetVM] = await Promise.all([
    prisma.user.findMany({ where: { role: { not: "OWNER" }, isActive: true }, orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
    prisma.salary.findMany({ where: { month } }),
    prisma.advance.findMany({ where: { month } }),
    getOwnerDashboardVM("MONTH", vmReferenceDate),
  ]);

  const skip = paginationSkip(page);
  const users = allUsers.slice(skip, skip + DEFAULT_PAGE_SIZE);
  const pages = totalPages(allUsers.length);

  const salaryByUser = new Map(salaries.map((s) => [s.userId, s]));
  const advanceByUser = new Map<string, number>();
  for (const a of advances) {
    advanceByUser.set(a.userId, (advanceByUser.get(a.userId) ?? 0) + Number(a.amount));
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

  // A driver's base salary keeps accruing trip-by-trip all month, so — while
  // the month is still ongoing — it's always shown live rather than frozen
  // at whatever "Тасдиқлаш" happened to lock in; only advance/fine/bonus
  // (accountant-entered, not auto-computed) stay frozen once approved.
  // netPay follows the same rule since it's derived from baseSalary.
  function effectivePay(u: (typeof allUsers)[number]) {
    const salary = salaryByUser.get(u.id);
    const advance = advanceByUser.get(u.id) ?? 0;
    const isDriverLive = u.role === "DRIVER" && isCurrentMonth;
    if (isDriverLive) {
      const baseSalary = driverPayByUserId.get(u.id)?.total ?? BigInt(0);
      const netPay = computeNetPay({
        baseSalary,
        bonus: salary?.bonus ?? BigInt(0),
        advancesTotal: BigInt(advance),
        finesTotal: salary?.finesTotal ?? BigInt(0),
      });
      return { baseSalary, netPay, netPayKnown: true };
    }
    const fallback = driverPayByUserId.get(u.id)?.total ?? u.baseSalary ?? BigInt(0);
    const baseSalary = salary?.baseSalary ?? fallback;
    return { baseSalary, netPay: salary?.netPay ?? BigInt(0), netPayKnown: !!salary };
  }

  const payByUserId = new Map(allUsers.map((u) => [u.id, effectivePay(u)]));

  const salaryFund = allUsers.reduce((s, u) => s + Number(payByUserId.get(u.id)!.baseSalary), 0);
  const advancesTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const finesTotal = salaries.reduce((s, sal) => s + Number(sal.finesTotal), 0);
  const bonusTotal = salaries.reduce((s, sal) => s + Number(sal.bonus), 0);
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
          const salary = salaryByUser.get(u.id);
          const advance = advanceByUser.get(u.id) ?? 0;
          const pay = payByUserId.get(u.id)!;
          const editable = isCurrentMonth && (!salary || salary.status === "DRAFT");
          return (
            <PayrollRowLink
              key={u.id}
              href={`/accountant/payroll/${u.id}?month=${monthStr}`}
              className="grid grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.85fr_0.8fr_0.75fr_0.9fr_1fr] gap-y-1.5 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm hover:bg-page transition-colors"
            >
              <div className="font-extrabold text-heading col-span-2 lg:col-span-1">{u.fullName}</div>
              <div>
                <RoleBadge role={u.role} point={u.point} />
              </div>
              <div className="font-bold text-heading">
                {formatSom(Number(pay.baseSalary))}
                {u.role === "DRIVER" && (
                  <span className="block text-[10px] text-muted-2 font-semibold">
                    {driverPayByUserId.get(u.id)?.dayCount ?? 0} кун ишлаган
                  </span>
                )}
              </div>
              <div className="font-extrabold text-primary">{advance > 0 ? `−${formatSom(advance)}` : "0"}</div>
              <div className="font-extrabold text-danger">
                {salary && Number(salary.finesTotal) > 0 ? `−${formatSom(Number(salary.finesTotal))}` : "0"}
              </div>
              <div>
                {salary && editable ? (
                  <form action={setBonusAction} className="flex items-center gap-1">
                    <input type="hidden" name="salaryId" value={salary.id} />
                    <MoneyInput
                      name="bonus"
                      defaultValue={Number(salary.bonus)}
                      className="w-20 bg-page border border-border rounded-md px-2 py-1 text-xs font-bold text-heading outline-none focus:border-primary"
                    />
                    <button type="submit" className="text-success text-xs font-extrabold">
                      ✓
                    </button>
                  </form>
                ) : (
                  <span className="font-bold text-success">+{formatSom(Number(salary?.bonus ?? 0))}</span>
                )}
              </div>
              <div className="font-heading font-extrabold text-heading flex items-center gap-1.5">
                {pay.netPayKnown ? formatSom(Number(pay.netPay)) : "—"}
                {salary && salary.status === "APPROVED" && isCurrentMonth && (
                  <form action={revertSalaryToDraftAction}>
                    <input type="hidden" name="salaryId" value={salary.id} />
                    <button
                      type="submit"
                      title="Қораламага қайтариш (янги жарима/аванс қўшилган бўлса)"
                      className="text-muted-2 hover:text-primary text-xs font-bold"
                    >
                      ↩
                    </button>
                  </form>
                )}
              </div>
            </PayrollRowLink>
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
