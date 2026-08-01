import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { logoutAction } from "@/app/actions";
import { ROLE_LABELS } from "@/components/ui/RoleBadge";

export default async function ComingSoonPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roleLabel = ROLE_LABELS[session.user.role] ?? session.user.role;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-[420px] p-10 flex flex-col items-center gap-4 text-center">
        <div className="w-[52px] h-[52px] rounded-2xl bg-primary text-white flex items-center justify-center font-heading font-bold text-[22px]">
          FQ
        </div>
        <div className="font-heading font-bold text-lg text-heading">
          Салом, {session.user.name}!
        </div>
        <p className="text-[13px] text-muted-2 font-semibold">
          {roleLabel} бўлими тез орада қўшилади. Ҳозирча фақат Эгаси (Owner) панели тайёр.
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="bg-primary-tint text-primary rounded-xl px-5 py-2.5 text-[13px] font-extrabold"
          >
            Чиқиш
          </button>
        </form>
      </Card>
    </div>
  );
}
