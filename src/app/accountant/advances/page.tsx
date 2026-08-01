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

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

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
        {advances.map((a) => (
          <div
            key={a.id}
            className="flex justify-between items-center px-6 py-3.5 border-t border-row-divider first:border-t-0 text-sm gap-3"
          >
            <div>
              <div className="font-extrabold text-heading">{a.user.fullName}</div>
              <div className="text-xs text-muted-2 font-semibold mt-0.5">
                {a.givenDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
              </div>
            </div>
            <RoleBadge role={a.user.role} point={a.user.point} />
            <div className="font-extrabold text-primary">−{formatSom(Number(a.amount))}</div>
          </div>
        ))}
        {advances.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу ой ҳали аванс берилмаган</p>}
        <Pagination page={page} totalPages={pages} basePath="/accountant/advances" />
      </Card>
    </div>
  );
}
