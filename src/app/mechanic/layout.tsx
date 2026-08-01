import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { hasAnyModuleAccess, getGrantedNavLinks, getGuestNavLinks } from "@/lib/access";
import { MechanicNavDesktop, MechanicNavMobile } from "./MechanicNav";

export default async function MechanicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isMechanic = session.user.role === "MECHANIC";
  if (!isMechanic && !(await hasAnyModuleAccess(session.user.role, ["VEHICLES", "FUEL", "SHIFTS"]))) {
    redirect("/coming-soon");
  }
  const extra = isMechanic
    ? await getGrantedNavLinks(session.user.role, ["VEHICLES", "FUEL", "SHIFTS"])
    : await getGuestNavLinks(session.user.role);

  return (
    <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
      <div className="flex items-center justify-between px-4 sm:px-7 py-[14px] sm:py-[18px] bg-card border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div className="font-heading font-bold text-base text-heading">Фарғона–Қува Автопарк</div>
        </div>

        <div className="hidden lg:block">
          <MechanicNavDesktop extra={extra} base={isMechanic ? undefined : []} />
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

      <MechanicNavMobile extra={extra} base={isMechanic ? undefined : []} />
    </div>
  );
}
