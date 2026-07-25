import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatSom } from "@/lib/format";
import { collectPlanPaymentAction } from "../actions";

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

export default async function DispatcherPointPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "DISPATCHER" || !session.user.point) redirect("/coming-soon");

  const point = session.user.point;
  const today = new Date();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const [vehicles, plansToday, tripsToday, myExpenseAgg, myLunch] = await Promise.all([
    prisma.vehicle.findMany({
      where: { point, status: "ACTIVE" },
      include: { driver: { include: { user: true } } },
      orderBy: { plate: "asc" },
    }),
    prisma.dailyPlan.findMany({
      where: { planDate: { gte: from, lte: to }, vehicle: { point } },
      include: { vehicle: true, driver: { include: { user: true } } },
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
  ]);

  const collectedToday =
    plansToday.reduce((s, p) => s + Number(p.paidAmount), 0) + tripsToday.reduce((s, t) => s + Number(t.revenue), 0);
  const vehiclesWithMoney = new Set([
    ...plansToday.filter((p) => Number(p.paidAmount) > 0).map((p) => p.vehicleId),
    ...tripsToday.map((t) => t.vehicleId),
  ]);
  const myExpenseToday = Number(myExpenseAgg._sum.amount ?? BigInt(0));
  const myLunchToday = myLunch ? Number(myLunch.amount) : 0;

  const entries = [
    ...plansToday
      .filter((p) => Number(p.paidAmount) > 0)
      .map((p) => ({
        time: p.paidAt ?? p.planDate,
        plate: p.vehicle.plate,
        driver: p.driver.user.fullName,
        amount: Number(p.paidAmount),
        note: Number(p.paidAmount) >= Number(p.planAmount) ? "Plan · to'liq" : "Plan · qisman",
      })),
    ...tripsToday.map((t) => ({
      time: t.createdAt,
      plate: t.vehicle.plate,
      driver: t.driver.user.fullName,
      amount: Number(t.revenue),
      note: t.kind === "ORDER" ? "Alohida zakaz" : "Reys tushumi",
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard variant="primary" label="Bugun yig'ildi" value={formatSom(collectedToday)} />
        <KpiCard label="Qabul qilingan mashina" value={`${vehiclesWithMoney.size} / ${vehicles.length}`} />
        <KpiCard label="Mening rasxodim (bugun)" value={`−${formatSom(myExpenseToday)}`} hintColor="danger" />
        <KpiCard label="Obed" value={myLunchToday ? `−${formatSom(myLunchToday)}` : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
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

        <Card className="p-5 flex flex-col gap-3">
          <div className="font-heading font-bold text-[15px] text-heading">Pul qabul qilish</div>
          <form action={collectPlanPaymentAction} className="flex flex-col gap-3">
            <select
              name="vehicleId"
              required
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.driver?.user.fullName ?? "—"}
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              required
              min={1}
              placeholder="Summa"
              className="bg-page border-2 border-primary rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
            />
            <button type="submit" className="bg-primary text-white rounded-xl py-3 font-extrabold text-sm">
              Qabul qilish ✓
            </button>
          </form>
          <p className="text-xs text-muted-2 font-semibold text-center pt-1">
            Rasxod va obed qo&apos;shish uchun{" "}
            <Link href="/dispatcher/journal" className="text-primary font-extrabold hover:underline">
              Jurnal
            </Link>{" "}
            bo&apos;limiga o&apos;ting
          </p>
        </Card>
      </div>
    </div>
  );
}
