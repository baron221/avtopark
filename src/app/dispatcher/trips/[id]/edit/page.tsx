import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { hasAnyModuleAccess } from "@/lib/access";
import { EditTripForm } from "./EditTripForm";
import type { Point } from "@prisma/client";

export default async function EditTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; point?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  const guestAllowed =
    !isDispatcher && (await hasAnyModuleAccess(session.user.role, ["TRIP_ENTRY", "COLLECT_PAYMENT"]));
  if (!isDispatcher && !guestAllowed) redirect("/coming-soon");

  const { id } = await params;
  const { from, point: pointParam } = await searchParams;

  const point: Point = isDispatcher ? session.user.point! : pointParam === "QUVA" ? "QUVA" : "FARGONA";

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || trip.point !== point) notFound();

  const drivers = await prisma.driver.findMany({ include: { user: true }, orderBy: { user: { fullName: "asc" } } });
  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.user.fullName }));

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
        <div className="font-heading font-bold text-xl text-heading mb-5">Рейсни таҳрирлаш</div>
        <EditTripForm
          tripId={trip.id}
          kind={trip.kind}
          driverId={trip.driverId}
          passengerCount={trip.passengerCount}
          tripNumber={trip.tripNumber}
          revenue={Number(trip.revenue)}
          note={trip.note ?? ""}
          drivers={driverOptions}
          point={isDispatcher ? undefined : point}
          backTo={backTo}
        />
      </Card>
    </div>
  );
}
