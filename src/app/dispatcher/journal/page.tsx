import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { formatSom } from "@/lib/format";
import { IncomeForm } from "./IncomeForm";
import { ExpenseForm } from "./ExpenseForm";

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

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Stoyanka",
  OZIQ_OVQAT: "Oziq-ovqat",
  BOSHQA: "Boshqa",
};

export default async function DispatcherJournalPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "DISPATCHER" || !session.user.point) redirect("/coming-soon");

  const point = session.user.point;
  const staffExpensePoint = point === "FARGONA" ? "FARGONA" : "QUVA";
  const today = new Date();
  const from = startOfDay(today);
  const to = endOfDay(today);
  const baseFareRoute = await prisma.route.findFirst({ where: { isActive: true } });

  const [vehicles, trips, expenses, lunches] = await Promise.all([
    prisma.vehicle.findMany({
      where: { point, status: "ACTIVE" },
      include: { driver: { include: { user: true } } },
      orderBy: { plate: "asc" },
    }),
    prisma.trip.findMany({
      where: { tripDate: { gte: from, lte: to }, vehicle: { point } },
      include: { vehicle: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffExpense.findMany({
      where: { point: staffExpensePoint, expenseDate: { gte: from, lte: to } },
    }),
    prisma.lunch.findMany({
      where: { lunchDate: { gte: from, lte: to }, user: { point } },
    }),
  ]);

  const kirim = trips.reduce((s, t) => s + Number(t.revenue), 0);
  const chiqim = expenses.reduce((s, e) => s + Number(e.amount), 0) + lunches.reduce((s, l) => s + Number(l.amount), 0);
  const qoldiq = kirim - chiqim;

  const vehicleOptions = vehicles
    .filter((v) => v.driver)
    .map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver!.user.fullName }));

  type LogEntry = { time: Date; kind: string; kindBg: string; kindColor: string; detail: string; amount: number };
  const log: LogEntry[] = [
    ...trips.map((t) => ({
      time: t.createdAt,
      kind: t.kind === "ORDER" ? "Zakaz" : "Reys",
      kindBg: t.kind === "ORDER" ? "#E4F5EC" : "#EEF0F8",
      kindColor: t.kind === "ORDER" ? "#1B9E6B" : "#4F46E5",
      detail: t.note ?? `${t.vehicle.plate} · Farg'ona → Quva`,
      amount: Number(t.revenue),
    })),
    ...expenses.map((e) => ({
      time: e.expenseDate,
      kind: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      kindBg: "#FDECEA",
      kindColor: "#D9534F",
      detail: e.note ?? EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      amount: -Number(e.amount),
    })),
    ...lunches.map((l) => ({
      time: l.lunchDate,
      kind: "Obed",
      kindBg: "#FFF3E0",
      kindColor: "#B26A00",
      detail: "Tushlik",
      amount: -Number(l.amount),
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">
            Kirim-chiqim · {today.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
          </div>
          <div className="text-[13px] text-muted-2 font-semibold">{session.user.name}</div>
        </div>
        <div className="flex gap-4 text-sm font-extrabold flex-wrap">
          <span className="text-success">Kirim: +{formatSom(kirim)}</span>
          <span className="text-danger">Chiqim: −{formatSom(chiqim)}</span>
          <span className="text-heading">Qoldiq: {formatSom(qoldiq)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_340px_1fr] gap-4 items-start">
        <IncomeForm vehicles={vehicleOptions} baseFare={baseFareRoute?.baseFare ?? 20000} />
        <ExpenseForm />

        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 font-heading font-bold text-[15px] text-heading">Bugungi jurnal</div>
          {log.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-[52px_100px_1fr_auto] gap-2.5 px-5 py-2.5 border-t border-row-divider items-center text-[13px]"
            >
              <div className="text-muted-2 font-bold">{formatTime(l.time)}</div>
              <div>
                <span
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                  style={{ background: l.kindBg, color: l.kindColor }}
                >
                  {l.kind}
                </span>
              </div>
              <div className="text-body font-semibold min-w-0 break-words">{l.detail}</div>
              <div className={`font-extrabold ${l.amount >= 0 ? "text-success" : "text-danger"}`}>
                {l.amount >= 0 ? "+" : "−"}
                {formatSom(Math.abs(l.amount))}
              </div>
            </div>
          ))}
          {log.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Bugun hali yozuv yo&apos;q</p>}
        </Card>
      </div>
    </div>
  );
}
