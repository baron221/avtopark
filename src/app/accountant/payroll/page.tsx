import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Pagination } from "@/components/ui/Pagination";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom, formatMillions, uzMonthName } from "@/lib/format";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { generatePayrollAction, approvePayrollAction, setBonusAction } from "./actions";

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT") redirect("/coming-soon");

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const now = new Date();
  const month = monthStart(now);

  const [allUsers, salaries, advances, fleetVM] = await Promise.all([
    prisma.user.findMany({ where: { role: { not: "OWNER" }, isActive: true }, orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
    prisma.salary.findMany({ where: { month } }),
    prisma.advance.findMany({ where: { month } }),
    getOwnerDashboardVM("MONTH"),
  ]);

  const skip = paginationSkip(page);
  const users = allUsers.slice(skip, skip + DEFAULT_PAGE_SIZE);
  const pages = totalPages(allUsers.length);

  const salaryByUser = new Map(salaries.map((s) => [s.userId, s]));
  const advanceByUser = new Map<string, number>();
  for (const a of advances) {
    advanceByUser.set(a.userId, (advanceByUser.get(a.userId) ?? 0) + Number(a.amount));
  }

  const salaryFund = allUsers.reduce((s, u) => s + Number(u.baseSalary ?? BigInt(0)), 0);
  const advancesTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const finesTotal = salaries.reduce((s, sal) => s + Number(sal.finesTotal), 0);
  const lunchTotal = salaries.reduce((s, sal) => s + Number(sal.lunchTotal), 0);
  const netProfitAfterAll = fleetVM.netProfit - (salaryFund + advancesTotal + finesTotal + lunchTotal);

  const allApproved = salaries.length > 0 && salaries.every((s) => s.status !== "DRAFT");

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Oylik hisob-kitob · {uzMonthName(now)} {now.getFullYear()}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Maosh + bonus − avans − jarima − obed = qo&apos;lga tegadi
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <form action={generatePayrollAction}>
            <button type="submit" className="bg-primary-tint text-primary rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]">
              Vedomostni yaratish/yangilash
            </button>
          </form>
          <Link
            href="/accountant/payroll/export"
            className="bg-card border border-border text-body rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]"
          >
            ⬇ Vedomost (Excel)
          </Link>
          <form action={approvePayrollAction}>
            <button
              type="submit"
              disabled={salaries.length === 0 || allApproved}
              className="bg-primary text-white rounded-[10px] px-4 py-2.5 font-extrabold text-[13px] disabled:opacity-50"
            >
              To&apos;lovni tasdiqlash
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Jami maosh fondi" value={formatMillions(salaryFund)} />
        <KpiCard label="Berilgan avanslar" value={`−${formatMillions(advancesTotal)}`} />
        <KpiCard label="Jarimalar (ushlab qolinadi)" value={`−${formatMillions(finesTotal)}`} hintColor="danger" />
        <KpiCard label="Obed xarajati" value={`−${formatMillions(lunchTotal)}`} />
        <KpiCard variant="primary" label="Sof foyda (barcha hisobdan keyin)" value={formatMillions(netProfitAfterAll)} />
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.3fr_0.9fr_0.85fr_0.8fr_0.75fr_0.75fr_0.9fr_1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Xodim</div>
          <div>Rol</div>
          <div>Maosh</div>
          <div>Avans</div>
          <div>Jarima</div>
          <div>Obed</div>
          <div>Bonus</div>
          <div>Qo&apos;lga tegadi</div>
        </div>
        {users.map((u) => {
          const salary = salaryByUser.get(u.id);
          const advance = advanceByUser.get(u.id) ?? 0;
          const editable = !salary || salary.status === "DRAFT";
          return (
            <div
              key={u.id}
              className="grid grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.85fr_0.8fr_0.75fr_0.75fr_0.9fr_1fr] gap-y-1.5 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="font-extrabold text-heading col-span-2 lg:col-span-1">{u.fullName}</div>
              <div>
                <RoleBadge role={u.role} point={u.point} />
              </div>
              <div className="font-bold text-heading">{formatSom(Number(u.baseSalary ?? BigInt(0)))}</div>
              <div className="font-extrabold text-primary">{advance > 0 ? `−${formatSom(advance)}` : "0"}</div>
              <div className="font-extrabold text-danger">
                {salary && Number(salary.finesTotal) > 0 ? `−${formatSom(Number(salary.finesTotal))}` : "0"}
              </div>
              <div className="font-bold text-warning">
                {salary && Number(salary.lunchTotal) > 0 ? `−${formatSom(Number(salary.lunchTotal))}` : "0"}
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
              <div className="font-heading font-extrabold text-heading">
                {salary ? formatSom(Number(salary.netPay)) : "—"}
              </div>
            </div>
          );
        })}
        {users.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Xodim topilmadi</p>}
        <Pagination page={page} totalPages={pages} basePath="/accountant/payroll" />
      </Card>
    </div>
  );
}
