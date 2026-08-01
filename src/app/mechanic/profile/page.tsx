import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { logoutAction } from "@/app/actions";

export default async function MechanicProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  return (
    <div className="max-w-[420px] mx-auto w-full p-4 sm:p-7">
      <Card className="p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-[52px] h-[52px] rounded-2xl bg-primary text-white flex items-center justify-center font-heading font-bold text-[22px]">
          {session.user.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="font-heading font-bold text-lg text-heading">{session.user.name}</div>
        <div className="text-[13px] text-muted-2 font-semibold">Механик</div>
        <form action={logoutAction} className="mt-2">
          <button type="submit" className="bg-danger-tint text-danger rounded-xl px-5 py-2.5 text-[13px] font-extrabold">
            Чиқиш
          </button>
        </form>
      </Card>
    </div>
  );
}
