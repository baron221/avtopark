import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER") redirect("/coming-soon");

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-7 py-[14px] sm:py-[18px] bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary text-white flex items-center justify-center font-heading font-bold text-base">
            FQ
          </div>
          <div className="font-heading font-bold text-base text-heading">Фарғона–Қува Автопарк</div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-[13px] font-semibold text-heading">{session.user.name}</div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs font-bold text-muted-2 hover:text-danger">
              Чиқиш
            </button>
          </form>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
