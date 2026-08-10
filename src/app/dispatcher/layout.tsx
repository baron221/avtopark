import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { hasAnyModuleAccess, getGrantedNavLinks, getGuestNavLinks } from "@/lib/access";
import { getActivePoint } from "@/lib/activePoint";
import { setActivePointAction } from "./actions";
import { DispatcherNavDesktop, DispatcherNavMobile } from "./DispatcherNav";

const POINT_LABELS: Record<string, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
};

export default async function DispatcherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  if (
    !isDispatcher &&
    !(await hasAnyModuleAccess(session.user.role, ["COLLECT_PAYMENT", "INCOME_EXPENSE_LOG", "TRIP_ENTRY"]))
  ) {
    redirect("/coming-soon");
  }

  const activePoint = isDispatcher ? await getActivePoint(session.user.point!) : null;
  const pointLabel = activePoint ? (POINT_LABELS[activePoint] ?? activePoint) : null;
  const extra = isDispatcher
    ? await getGrantedNavLinks(session.user.role, ["COLLECT_PAYMENT", "INCOME_EXPENSE_LOG", "TRIP_ENTRY"])
    : await getGuestNavLinks(session.user.role);

  return (
    <div className="min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="flex items-center justify-between px-4 sm:px-7 py-[14px] sm:py-[18px] bg-card border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div>
            <div className="font-heading font-bold text-base text-heading">Фарғона–Қува Автопарк</div>
            {activePoint && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                  📍 {pointLabel} пункти
                </span>
                <form action={setActivePointAction}>
                  <input type="hidden" name="point" value={activePoint === "FARGONA" ? "QUVA" : "FARGONA"} />
                  <button type="submit" className="text-[11px] text-primary font-bold hover:underline whitespace-nowrap">
                    {activePoint === "FARGONA" ? "Қувага ўтиш" : "Фарғонага ўтиш"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <DispatcherNavDesktop extra={extra} base={isDispatcher ? undefined : []} />
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

      <DispatcherNavMobile extra={extra} base={isDispatcher ? undefined : []} />
    </div>
  );
}
