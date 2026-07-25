import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatSom } from "@/lib/format";

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

export default async function DriverPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER") redirect("/coming-soon");

  const driver = await prisma.driver.findUnique({
    where: { userId: session.user.id },
    include: { vehicle: true },
  });

  if (!driver) {
    return (
      <div className="max-w-[520px] mx-auto w-full p-7">
        <Card className="p-8 text-center text-[13px] text-muted-2 font-semibold">
          Haydovchi profili topilmadi. Iltimos, administrator bilan bog&apos;laning.
        </Card>
      </div>
    );
  }

  const now = new Date();
  const today = { from: startOfDay(now), to: endOfDay(now) };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTrips, todayPlan, monthTrips, monthPlan, salary] = await Promise.all([
    prisma.trip.findMany({
      where: { driverId: driver.id, tripDate: { gte: today.from, lte: today.to } },
      include: { route: true },
      orderBy: { createdAt: "asc" },
    }),
    driver.vehicleId
      ? prisma.dailyPlan.findFirst({
          where: { vehicleId: driver.vehicleId, planDate: { gte: today.from, lte: today.to } },
        })
      : null,
    prisma.trip.aggregate({
      _sum: { revenue: true },
      where: { driverId: driver.id, tripDate: { gte: monthStart } },
    }),
    prisma.dailyPlan.aggregate({
      _sum: { paidAmount: true },
      where: { driverId: driver.id, planDate: { gte: monthStart } },
    }),
    prisma.salary.findUnique({ where: { userId_month: { userId: session.user.id, month: monthStart } } }),
  ]);

  const todayTripRevenue = todayTrips.reduce((s, t) => s + Number(t.revenue), 0);
  const todayPlanPaid = todayPlan ? Number(todayPlan.paidAmount) : 0;
  const todayTotal = todayTripRevenue + todayPlanPaid;

  const monthTotal = Number(monthTrips._sum.revenue ?? BigInt(0)) + Number(monthPlan._sum.paidAmount ?? BigInt(0));

  return (
    <div className="max-w-[720px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Salom, {session.user.name}!</div>
        <div className="text-[13px] text-muted-2 font-semibold">
          {driver.vehicle ? `${driver.vehicle.plate} · ${driver.vehicle.model}` : "Mashina biriktirilmagan"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard variant="primary" label="Bugungi tushum" value={formatSom(todayTotal)} />
        <KpiCard label="Bugungi reyslar" value={String(todayTrips.length)} />
        <KpiCard label="Oy boshidan tushum" value={formatSom(monthTotal)} />
        <KpiCard
          label="Kunlik plan"
          value={todayPlan ? `${formatSom(Number(todayPlan.paidAmount))} / ${formatSom(Number(todayPlan.planAmount))}` : "—"}
          hint={todayPlan ? undefined : "Bu mashina reys asosida ishlaydi"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 font-heading font-bold text-[15px] text-heading">Bugungi reyslar</div>
        {todayTrips.map((t) => (
          <div
            key={t.id}
            className="flex justify-between items-center px-5 py-3 border-t border-row-divider text-sm gap-3"
          >
            <div className="text-muted-2 font-bold w-12 shrink-0">{formatTime(t.departureTime)}</div>
            <div className="flex-1 font-semibold text-heading min-w-0 break-words">
              {t.kind === "ORDER" ? t.note ?? "Alohida zakaz" : `${t.route.fromCity} → ${t.route.toCity}`}
              {t.kind === "TRIP" && <span className="text-muted-2 font-normal"> · {t.passengerCount} yo&apos;lovchi</span>}
            </div>
            <div className="font-extrabold text-success shrink-0">+{formatSom(Number(t.revenue))}</div>
          </div>
        ))}
        {todayTrips.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Bugun hali reys yo&apos;q</p>}
      </Card>

      <Card className="p-5">
        <div className="font-heading font-bold text-[15px] text-heading mb-3">
          Oylik hisob · {now.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" })}
        </div>
        {salary ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-2 font-semibold">Maosh</span>
              <span className="font-bold text-heading">{formatSom(Number(salary.baseSalary))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-2 font-semibold">Bonus</span>
              <span className="font-bold text-success">+{formatSom(Number(salary.bonus))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-2 font-semibold">Jarima</span>
              <span className="font-bold text-danger">−{formatSom(Number(salary.finesTotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-2 font-semibold">Obed</span>
              <span className="font-bold text-warning">−{formatSom(Number(salary.lunchTotal))}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-row-divider">
              <span className="text-heading font-extrabold">Qo&apos;lga tegadi</span>
              <span className="font-extrabold text-heading">{formatSom(Number(salary.netPay))}</span>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted-2">Bu oy uchun hisob-kitob hali buxgalter tomonidan yopilmagan.</p>
        )}
      </Card>
    </div>
  );
}
