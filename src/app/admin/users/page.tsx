import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { RoleBadge, ROLE_LABELS } from "@/components/ui/RoleBadge";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { toggleActiveAction } from "./actions";
import { DeleteUserButton } from "./DeleteUserButton";
import { hasModuleAccess } from "@/lib/access";
import type { Role } from "@prisma/client";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; deleteError?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && !(await hasModuleAccess(session.user.role, "USER_MANAGEMENT"))) {
    redirect("/coming-soon");
  }

  const { page: pageParam, deleteError } = await searchParams;
  const page = parsePage(pageParam);

  const [users, totalCount, roleCounts] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      skip: paginationSkip(page),
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: true }),
  ]);

  const counts = roleCounts.reduce(
    (acc, r) => {
      acc[r.role] = r._count;
      return acc;
    },
    {} as Record<Role, number>
  );
  const summary = (Object.keys(ROLE_LABELS) as Role[])
    .filter((r) => counts[r])
    .map((r) => `${counts[r]} ${ROLE_LABELS[r].toLowerCase()}`)
    .join(" · ");

  const pages = totalPages(totalCount);

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Foydalanuvchilar va rollar</div>
          <div className="text-[13px] text-muted-2 font-semibold">{summary}</div>
        </div>
        <Link
          href="/admin/users/new"
          className="bg-primary text-white rounded-[10px] px-[18px] py-2.5 font-extrabold text-[13px]"
        >
          + Foydalanuvchi qo&apos;shish
        </Link>
      </div>

      {deleteError && (
        <div className="bg-danger-tint text-danger text-[13px] font-bold px-4 py-3 rounded-xl">{deleteError}</div>
      )}

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="grid grid-cols-[1.2fr_1.1fr_1fr_0.6fr_1.7fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>F.I.Sh.</div>
          <div>Rol</div>
          <div>Telefon (login)</div>
          <div>Holat</div>
          <div>Amallar</div>
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-[1.2fr_1.1fr_1fr_0.6fr_1.7fr] px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="font-extrabold text-heading">{u.fullName}</div>
            <div>
              <RoleBadge role={u.role} point={u.point} />
            </div>
            <div className="text-body font-bold">{u.phone}</div>
            <div>
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                  u.isActive ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
                }`}
              >
                {u.isActive ? "Faol" : "Bloklangan"}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/admin/users/${u.id}/edit`}
                className="bg-page text-heading text-xs font-extrabold px-3 py-1.5 rounded-lg border border-border"
              >
                Tahrirlash
              </Link>
              <Link
                href={`/admin/users/${u.id}/reset-password`}
                className="bg-primary-tint text-primary text-xs font-extrabold px-3 py-1.5 rounded-lg"
              >
                Parol
              </Link>
              <form action={toggleActiveAction}>
                <input type="hidden" name="userId" value={u.id} />
                <button
                  type="submit"
                  className={`text-xs font-extrabold px-3 py-1.5 rounded-lg ${
                    u.isActive ? "bg-danger-tint text-danger" : "bg-success-tint text-success"
                  }`}
                >
                  {u.isActive ? "Bloklash" : "Faollashtirish"}
                </button>
              </form>
              {u.id !== session.user.id && (
                <DeleteUserButton
                  userId={u.id}
                  fullName={u.fullName}
                  page={page}
                  className="bg-danger text-white text-xs font-extrabold px-3 py-1.5 rounded-lg"
                />
              )}
            </div>
          </div>
        ))}
        <Pagination page={page} totalPages={pages} basePath="/admin/users" />
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {users.map((u) => (
          <Card key={u.id} className="p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-extrabold text-heading text-sm">{u.fullName}</div>
                <div className="text-xs text-muted-2 font-bold mt-0.5">{u.phone}</div>
              </div>
              <RoleBadge role={u.role} point={u.point} />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-row-divider">
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                  u.isActive ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
                }`}
              >
                {u.isActive ? "Faol" : "Bloklangan"}
              </span>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/admin/users/${u.id}/edit`}
                  className="bg-page text-heading text-xs font-extrabold px-3 py-1.5 rounded-lg border border-border"
                >
                  Tahrirlash
                </Link>
                <Link
                  href={`/admin/users/${u.id}/reset-password`}
                  className="bg-primary-tint text-primary text-xs font-extrabold px-3 py-1.5 rounded-lg"
                >
                  Parol
                </Link>
                <form action={toggleActiveAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className={`text-xs font-extrabold px-3 py-1.5 rounded-lg ${
                      u.isActive ? "bg-danger-tint text-danger" : "bg-success-tint text-success"
                    }`}
                  >
                    {u.isActive ? "Bloklash" : "Faollashtirish"}
                  </button>
                </form>
                {u.id !== session.user.id && (
                  <DeleteUserButton
                    userId={u.id}
                    fullName={u.fullName}
                    page={page}
                    className="bg-danger text-white text-xs font-extrabold px-3 py-1.5 rounded-lg"
                  />
                )}
              </div>
            </div>
          </Card>
        ))}
        <Card>
          <Pagination page={page} totalPages={pages} basePath="/admin/users" />
        </Card>
      </div>
    </div>
  );
}
