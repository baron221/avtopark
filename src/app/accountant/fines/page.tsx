import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom, uzMonthName } from "@/lib/format";
import { toggleFineDeductedAction, deleteFineAction } from "./actions";
import { hasModuleAccess } from "@/lib/access";
import { monthStart, monthEnd } from "@/lib/month";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";

export default async function FinesPage({
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
  const from = monthStart(now);
  const to = monthEnd(now);

  const [fines, totalCount, deductedAgg] = await Promise.all([
    prisma.fine.findMany({
      where: { fineDate: { gte: from, lte: to } },
      include: { user: true, vehicle: true },
      orderBy: { fineDate: "desc" },
      skip: paginationSkip(page),
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.fine.count({ where: { fineDate: { gte: from, lte: to } } }),
    prisma.fine.aggregate({
      where: { fineDate: { gte: from, lte: to }, deducted: true },
      _sum: { amount: true },
    }),
  ]);

  const total = Number(deductedAgg._sum.amount ?? BigInt(0));
  const pages = totalPages(totalCount);

  return (
    <div className="max-w-[900px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Жарималар · {uzMonthName(now)} {now.getFullYear()}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">Ушлаб қолинадиган жами: {formatSom(total)}</div>
        </div>
        <Link
          href="/accountant/fines/new"
          className="bg-danger text-white rounded-[10px] px-[18px] py-2.5 font-extrabold text-[13px]"
        >
          + Жарима қўшиш
        </Link>
      </div>

      <Card className="overflow-hidden">
        {fines.map((f) => (
          <div
            key={f.id}
            className="flex justify-between items-center px-6 py-3.5 border-t border-row-divider first:border-t-0 text-sm gap-3 flex-wrap"
          >
            <div className="min-w-0">
              <div className="font-extrabold text-heading">{f.user.fullName}</div>
              <div className="text-xs text-muted-2 font-semibold mt-0.5 break-words">
                {f.reason}
                {f.vehicle ? ` · ${f.vehicle.plate}` : ""} ·{" "}
                {f.fineDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
              </div>
            </div>
            <RoleBadge role={f.user.role} point={f.user.point} />
            <div className="font-extrabold text-danger">−{formatSom(Number(f.amount))}</div>
            <form action={toggleFineDeductedAction}>
              <input type="hidden" name="fineId" value={f.id} />
              <button
                type="submit"
                className={`text-xs font-extrabold px-3 py-1.5 rounded-lg ${
                  f.deducted ? "bg-danger-tint text-danger" : "bg-success-tint text-success"
                }`}
              >
                {f.deducted ? "Ушланмоқда" : "Бекор қилинган"}
              </button>
            </form>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/accountant/fines/${f.id}/edit`}
                title="Таҳрирлаш"
                className="text-muted-2 hover:text-primary text-base leading-none px-1"
              >
                ✎
              </Link>
              <ConfirmDeleteButton
                action={deleteFineAction}
                id={f.id}
                confirmText="Бу жаримани ўчиришни тасдиқлайсизми?"
                className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
              />
            </div>
          </div>
        ))}
        {fines.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Бу ой ҳали жарима йўқ</p>}
        <Pagination page={page} totalPages={pages} basePath="/accountant/fines" />
      </Card>
    </div>
  );
}
