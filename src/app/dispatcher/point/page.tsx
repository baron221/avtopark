import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { IncomeForm } from "../journal/IncomeForm";
import type { Point } from "@prisma/client";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export default async function DispatcherPointPage({
  searchParams,
}: {
  searchParams: Promise<{ point?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isDispatcher = session.user.role === "DISPATCHER" && !!session.user.point;
  const guestAllowed = !isDispatcher && (await hasModuleAccess(session.user.role, "COLLECT_PAYMENT"));
  if (!isDispatcher && !guestAllowed) redirect("/coming-soon");

  const { point: pointParam } = await searchParams;
  const point: Point = isDispatcher ? session.user.point! : pointParam === "QUVA" ? "QUVA" : "FARGONA";
  const today = new Date();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const [vehicles, tripsToday, myExpenseAgg, myLunch, baseFareRoute] = await Promise.all([
    prisma.vehicle.findMany({
      where: { point, status: "ACTIVE" },
      include: { driver: { include: { user: true } } },
      orderBy: { plate: "asc" },
    }),
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to }, vehicle: { point } },
      include: { vehicle: true, driver: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffExpense.aggregate({
      _sum: { amount: true },
      where: { userId: session.user.id, expenseDate: { gte: from, lte: to } },
    }),
    prisma.lunch.findUnique({ where: { userId_lunchDate: { userId: session.user.id, lunchDate: from } } }),
    prisma.route.findFirst({ where: { isActive: true } }),
  ]);

  const collectedToday = tripsToday.reduce((s, t) => s + Number(t.revenue), 0);
  const vehiclesWithMoney = new Set(tripsToday.map((t) => t.vehicleId));
  const myExpenseToday = Number(myExpenseAgg._sum.amount ?? BigInt(0));
  const myLunchToday = myLunch ? Number(myLunch.amount) : 0;

  const entries = tripsToday
    .map((t) => ({
      time: t.createdAt,
      plate: t.vehicle.plate,
      driver: t.driver.user.fullName,
      amount: Number(t.revenue),
      note: t.kind === "ORDER" ? "Alohida zakaz" : "Reys tushumi",
    }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const vehicleOptions = vehicles
    .filter((v) => v.driver)
    .map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver!.user.fullName }));

  const pointLabel = point === "FARGONA" ? "Farg'ona" : "Quva";

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            {pointLabel} punkti · {today.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">
            {session.user.name} · kelgan har mashinadan pul qabul qilinadi
          </div>
        </div>
        {!isDispatcher && (
          <div className="flex gap-2">
            <Link
              href="/dispatcher/point?point=FARGONA"
              className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                point === "FARGONA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
              }`}
            >
              Farg&apos;ona
            </Link>
            <Link
              href="/dispatcher/point?point=QUVA"
              className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
                point === "QUVA" ? "bg-primary text-white" : "bg-card border border-border text-muted"
              }`}
            >
              Quva
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard variant="primary" label="Bugun yig'ildi" value={formatSom(collectedToday)} />
        <KpiCard label="Qabul qilingan mashina" value={`${vehiclesWithMoney.size} / ${vehicles.length}`} />
        <KpiCard label="Mening rasxodim (bugun)" value={`−${formatSom(myExpenseToday)}`} hintColor="danger" />
        <KpiCard label="Obed" value={myLunchToday ? `−${formatSom(myLunchToday)}` : "—"} />
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[0.6fr_1fr_1.2fr_0.9fr_1.1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Vaqt</div>
          <div>Mashina</div>
          <div>Haydovchi</div>
          <div>Summa</div>
          <div>Izoh</div>
        </div>
        {entries.map((e, i) => (
          <div
            key={i}
            className="grid grid-cols-2 lg:grid-cols-[0.6fr_1fr_1.2fr_0.9fr_1.1fr] gap-1 px-6 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="text-muted-2 font-bold">{formatTime(e.time)}</div>
            <div className="font-extrabold text-primary font-heading">{e.plate}</div>
            <div className="font-semibold text-heading">{e.driver}</div>
            <div className="font-extrabold text-heading">{formatSom(e.amount)}</div>
            <div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-success-tint text-success">
                {e.note}
              </span>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Bugun hali yozuv yo&apos;q</p>}
      </Card>

      <div className="max-w-[420px] w-full">
        <IncomeForm
          vehicles={vehicleOptions}
          baseFare={baseFareRoute?.baseFare ?? 20000}
          point={isDispatcher ? undefined : point}
        />
        <p className="text-xs text-muted-2 font-semibold text-center pt-3">
          Rasxod va obed qo&apos;shish uchun{" "}
          <Link href="/dispatcher/journal" className="text-primary font-extrabold hover:underline">
            Jurnal
          </Link>{" "}
          bo&apos;limiga o&apos;ting
        </p>
      </div>
    </div>
  );
}
