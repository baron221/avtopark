import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { hasAnyModuleAccess, getGuestNavLinks } from "@/lib/access";
import { AdminNavDesktop, AdminNavMobile } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && !(await hasAnyModuleAccess(session.user.role, ["FLEET_DASHBOARD", "USER_MANAGEMENT", "SHIFTS"]))) {
    redirect("/coming-soon");
  }
  const extra = isAdmin ? [] : await getGuestNavLinks(session.user.role);

  return (
    <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
      <div className="flex items-center justify-between px-4 sm:px-7 py-[14px] sm:py-[18px] bg-card border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div className="font-heading font-bold text-base text-heading">Farg&apos;ona–Quva Avtopark</div>
        </div>

        <div className="hidden lg:block">
          <AdminNavDesktop items={isAdmin ? undefined : extra} />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-[13px] font-semibold text-heading">{session.user.name}</div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs font-bold text-muted-2 hover:text-danger">
              Chiqish
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1">{children}</div>

      <AdminNavMobile items={isAdmin ? undefined : extra} />
    </div>
  );
}
