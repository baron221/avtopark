import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom, uzMonthName } from "@/lib/format";

const POINT_LABELS: Record<string, string> = {
  FARGONA: "Farg'ona",
  QUVA: "Quva",
  YOLDA: "Yo'lda",
};

const CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Stoyanka",
  OZIQ_OVQAT: "Oziq-ovqat",
  BOSHQA: "Boshqa",
};

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default async function AccountantExpensesPage({
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
  const from = monthStart(now);
  const to = monthEnd(now);

  const [expenses, totalCount, byPoint, enteredByUsers] = await Promise.all([
    prisma.staffExpense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      orderBy: { expenseDate: "desc" },
      skip: paginationSkip(page),
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.staffExpense.count({ where: { expenseDate: { gte: from, lte: to } } }),
    prisma.staffExpense.groupBy({
      by: ["point"],
      where: { expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);

  const nameById = new Map(enteredByUsers.map((u) => [u.id, u.fullName]));
  const pointTotal: Record<string, number> = { FARGONA: 0, QUVA: 0, YOLDA: 0 };
  for (const row of byPoint) pointTotal[row.point] = Number(row._sum.amount ?? BigInt(0));
  const grandTotal = Object.values(pointTotal).reduce((s, v) => s + v, 0);

  const pages = totalPages(totalCount);

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Rasxodlar · {uzMonthName(now)} {now.getFullYear()}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Dispetcherlar (Farg&apos;ona, Quva) kiritgan kunlik rasxodlar
          </div>
        </div>
        <Link
          href="/accountant/expenses/new"
          className="bg-danger text-white rounded-[10px] px-[18px] py-2.5 font-extrabold text-[13px]"
        >
          + Boshqa rasxod
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs font-bold text-muted-2 uppercase">Farg&apos;ona</div>
          <div className="font-heading font-extrabold text-xl text-danger mt-1">−{formatSom(pointTotal.FARGONA)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-muted-2 uppercase">Quva</div>
          <div className="font-heading font-extrabold text-xl text-danger mt-1">−{formatSom(pointTotal.QUVA)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-muted-2 uppercase">Jami (Yo&apos;lda bilan)</div>
          <div className="font-heading font-extrabold text-xl text-heading mt-1">−{formatSom(grandTotal)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {expenses.map((e) => (
          <div
            key={e.id}
            className="flex justify-between items-center gap-3 px-5 py-3.5 border-t border-row-divider first:border-t-0 text-sm flex-wrap"
          >
            <div>
              <div className="font-extrabold text-heading">{nameById.get(e.userId) ?? "—"}</div>
              <div className="text-xs text-muted-2 font-semibold mt-0.5">
                {e.expenseDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} · {e.note ?? "—"}
              </div>
            </div>
            <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
              {POINT_LABELS[e.point] ?? e.point}
            </span>
            <span className="bg-page border border-border text-muted text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
              {CATEGORY_LABELS[e.category] ?? e.category}
            </span>
            <div className="font-extrabold text-danger">−{formatSom(Number(e.amount))}</div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Bu oy hali rasxod yo&apos;q</p>}
        <Pagination page={page} totalPages={pages} basePath="/accountant/expenses" />
      </Card>
    </div>
  );
}
