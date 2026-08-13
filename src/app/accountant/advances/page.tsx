import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom, uzMonthName } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { monthStart } from "@/lib/month";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { deleteAdvanceAction } from "./actions";

export default async function AdvancesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const now = new Date();
  const month = monthStart(now);

  const [advances, totalCount, totalAgg] = await Promise.all([
    prisma.advance.findMany({
      where: { month },
      include: { user: true },
      orderBy: { givenDate: "desc" },
      skip: paginationSkip(page),
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.advance.count({ where: { month } }),
    prisma.advance.aggregate({ where: { month }, _sum: { amount: true } }),
  ]);

  const total = Number(totalAgg._sum.amount ?? BigInt(0));
  const pages = totalPages(totalCount);

  return (
    <div className="max-w-[900px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Аванслар · {uzMonthName(now)} {now.getFullYear()}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">Жами берилган: {formatSom(total)}</div>
        </div>
        <Link
          href="/accountant/advances/new"
          className="bg-success text-white rounded-[10px] px-[18px] py-2.5 font-extrabold text-[13px]"
        >
          + Аванс бериш
        </Link>
      </div>

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden lg:grid grid-cols-[1.8fr_1fr_1fr_0.8fr] px-6 py-2 bg-page text-[11px] font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Ходим</div>
          <div>Рол</div>
          <div>Сумма</div>
          <div>Амаллар</div>
        </div>
        {advances.map((a) => (
          <div
            key={a.id}
            className="hidden lg:grid grid-cols-[1.8fr_1fr_1fr_0.8fr] gap-x-2 px-6 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="min-w-0">
              <div className="font-extrabold text-heading truncate">{a.user.fullName}</div>
              <div className="text-xs text-muted-2 font-semibold mt-0.5">
                {a.givenDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
              </div>
            </div>
            <div>
              <RoleBadge role={a.user.role} point={a.user.point} />
            </div>
            <div className="font-extrabold text-primary">−{formatSom(Number(a.amount))}</div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/accountant/advances/${a.id}/edit`}
                title="Таҳрирлаш"
                className="text-muted-2 hover:text-primary text-base leading-none px-1"
              >
                ✎
              </Link>
              <ConfirmDeleteButton
                action={deleteAdvanceAction}
                id={a.id}
                confirmText="Бу авансни ўчиришни тасдиқлайсизми?"
                className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
              />
            </div>
          </div>
        ))}

        {/* Mobile cards */}
        <div className="lg:hidden">
          {advances.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-6 py-3 border-t border-row-divider first:border-t-0 text-sm">
              <div className="min-w-0">
                <div className="font-extrabold text-heading truncate">{a.user.fullName}</div>
                <div className="text-xs text-muted-2 font-semibold mt-0.5">
                  {a.givenDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
                </div>
                <div className="mt-1">
                  <RoleBadge role={a.user.role} point={a.user.point} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="font-extrabold text-primary whitespace-nowrap">−{formatSom(Number(a.amount))}</div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/accountant/advances/${a.id}/edit`}
                    title="Таҳрирлаш"
                    className="text-muted-2 hover:text-primary text-base leading-none px-1"
                  >
                    ✎
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteAdvanceAction}
                    id={a.id}
                    confirmText="Бу авансни ўчиришни тасдиқлайсизми?"
                    className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {advances.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу ой ҳали аванс берилмаган</p>}
        <Pagination page={page} totalPages={pages} basePath="/accountant/advances" />
      </Card>
    </div>
  );
}
