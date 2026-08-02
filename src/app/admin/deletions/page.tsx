import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Trip: "Рейс/Заказ",
  StaffExpense: "Ходим харажати",
  Lunch: "Тушлик",
  User: "Фойдаланувчи",
};

function formatDateTime(d: Date) {
  return d.toLocaleString("uz-UZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminDeletionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/coming-soon");

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const [logs, totalCount] = await Promise.all([
    prisma.deletionLog.findMany({
      orderBy: { deletedAt: "desc" },
      include: { deletedByUser: true },
      skip: paginationSkip(page),
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.deletionLog.count(),
  ]);

  const pages = totalPages(totalCount);

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Ўчирилган ёзувлар тарихи</div>
        <div className="text-[13px] text-muted-2 font-semibold">
          Жами {totalCount} та ёзув · ким, қачон, нимани ўчирганини кўрсатади
        </div>
      </div>

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="grid grid-cols-[1.4fr_1.1fr_2fr_1.3fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Сана</div>
          <div>Тури</div>
          <div>Тафсилот</div>
          <div>Ким ўчирди</div>
        </div>
        {logs.map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-[1.4fr_1.1fr_2fr_1.3fr] px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="text-muted-2 font-bold text-[13px]">{formatDateTime(log.deletedAt)}</div>
            <div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-danger-tint text-danger">
                {ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}
              </span>
            </div>
            <div className="text-body font-semibold min-w-0 break-words">{log.summary}</div>
            <div className="font-extrabold text-heading">{log.deletedByUser.fullName}</div>
          </div>
        ))}
        {logs.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳали ўчирилган ёзув йўқ</p>}
        <Pagination page={page} totalPages={pages} basePath="/admin/deletions" />
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {logs.map((log) => (
          <Card key={log.id} className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-danger-tint text-danger">
                {ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}
              </span>
              <div className="text-xs text-muted-2 font-bold">{formatDateTime(log.deletedAt)}</div>
            </div>
            <div className="text-body font-semibold text-sm break-words">{log.summary}</div>
            <div className="text-xs text-muted-2 font-bold pt-1 border-t border-row-divider">
              Ким ўчирди: <span className="text-heading font-extrabold">{log.deletedByUser.fullName}</span>
            </div>
          </Card>
        ))}
        {logs.length === 0 && (
          <Card className="p-4">
            <p className="text-[13px] text-muted-2">Ҳали ўчирилган ёзув йўқ</p>
          </Card>
        )}
        <Card>
          <Pagination page={page} totalPages={pages} basePath="/admin/deletions" />
        </Card>
      </div>
    </div>
  );
}
