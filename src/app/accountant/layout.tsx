import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { hasAnyModuleAccess, hasModuleAccess, getGrantedNavLinks, getGuestNavLinks } from "@/lib/access";
import { getPendingCashHandoverCount } from "@/lib/ownerPayout";
import { AccountantNavDesktop, AccountantNavMobile } from "./AccountantNav";

export default async function AccountantLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAccountant = session.user.role === "ACCOUNTANT";
  if (!isAccountant && !(await hasAnyModuleAccess(session.user.role, ["FLEET_DASHBOARD", "PAYROLL"]))) {
    redirect("/coming-soon");
  }
  const extra = isAccountant
    ? await getGrantedNavLinks(session.user.role, ["FLEET_DASHBOARD", "PAYROLL"])
    : await getGuestNavLinks(session.user.role);
  const canSeeReport = isAccountant || (await hasModuleAccess(session.user.role, "FLEET_DASHBOARD"));
  const reportBadgeCount = canSeeReport ? await getPendingCashHandoverCount() : 0;

  return (
    <div className="min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="flex items-center justify-between px-4 sm:px-7 py-[14px] sm:py-[18px] bg-card border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div className="font-heading font-bold text-base text-heading">Фарғона–Қува Автопарк</div>
        </div>

        <div className="hidden lg:block">
          <AccountantNavDesktop extra={extra} base={isAccountant ? undefined : []} reportBadgeCount={reportBadgeCount} />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-[13px] font-semibold text-heading">{session.user.name}</div>
          <form action={logoutAction}>
            <button type="submit" className="bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-xs font-bold hover:border-danger hover:text-danger hover:bg-danger-tint transition-colors">
              Чиқиш
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1">{children}</div>

      <AccountantNavMobile extra={extra} base={isAccountant ? undefined : []} reportBadgeCount={reportBadgeCount} />
    </div>
  );
}
