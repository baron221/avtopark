import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { getGrantedNavLinks } from "@/lib/access";
import { DispatcherNavDesktop, DispatcherNavMobile } from "./DispatcherNav";

const POINT_LABELS: Record<string, string> = {
  FARGONA: "Farg'ona",
  QUVA: "Quva",
};

export default async function DispatcherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "DISPATCHER" || !session.user.point) redirect("/coming-soon");

  const pointLabel = POINT_LABELS[session.user.point] ?? session.user.point;
  const extra = await getGrantedNavLinks(session.user.role);

  return (
    <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
      <div className="flex items-center justify-between px-4 sm:px-7 py-[14px] sm:py-[18px] bg-card border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div>
            <div className="font-heading font-bold text-base text-heading">Farg&apos;ona–Quva Avtopark</div>
            <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              📍 {pointLabel} punkti
            </span>
          </div>
        </div>

        <div className="hidden lg:block">
          <DispatcherNavDesktop extra={extra} />
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

      <DispatcherNavMobile extra={extra} />
    </div>
  );
}
