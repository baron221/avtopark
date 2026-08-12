import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasModuleAccess } from "@/lib/access";
import { getActivePoint } from "@/lib/activePoint";
import { EditLunchForm } from "./EditLunchForm";
import type { Point } from "@prisma/client";

export default async function EditLunchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; point?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  const guestAllowed = !isDispatcher && (await hasModuleAccess(session.user.role, "INCOME_EXPENSE_LOG"));
  if (!isDispatcher && !guestAllowed) redirect("/coming-soon");

  const { id } = await params;
  const { from, point: pointParam } = await searchParams;

  const point: Point = isDispatcher
    ? await getActivePoint(session.user.id, session.user.point!)
    : pointParam === "QUVA"
      ? "QUVA"
      : "FARGONA";

  const lunch = await prisma.lunch.findUnique({ where: { id }, include: { user: true } });
  if (!lunch || lunch.point !== point) notFound();

  const backTo: "journal" | "point" = from === "point" ? "point" : "journal";
  const backHref = backTo === "point" ? "/dispatcher/point" : "/dispatcher/journal";

  return (
    <div className="max-w-[480px] mx-auto w-full p-4 sm:p-7">
      <Link
        href={backHref}
        className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
      >
        ← Орқага
      </Link>
      <Card className="p-6 sm:p-8 mt-3">
        <div className="font-heading font-bold text-xl text-heading mb-5">
          Обедни таҳрирлаш · {lunch.user.fullName}
        </div>
        <EditLunchForm
          lunchId={lunch.id}
          amount={Number(lunch.amount)}
          point={isDispatcher ? undefined : point}
          backTo={backTo}
        />
      </Card>
    </div>
  );
}
