import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { formatSom } from "@/lib/format";
import { markPaymentPaidAction, addStationPaymentAction } from "./actions";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: "#E4F5EC", color: "#1B9E6B", label: "To'landi" },
  PENDING: { bg: "#FFF3E0", color: "#B26A00", label: "To'lov kutilmoqda" },
};

export default async function StationPaymentsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  const [payments, stations] = await Promise.all([
    prisma.stationPayment.findMany({ include: { station: true }, orderBy: { periodEnd: "desc" } }),
    prisma.fuelStation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="font-heading font-bold text-xl text-heading">Zapravka to&apos;lovlari</div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="overflow-hidden">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center gap-3 px-5 py-3.5 border-t border-row-divider first:border-t-0 text-sm flex-wrap"
            >
              <div>
                <div className="font-extrabold text-heading">{p.station.name}</div>
                <div className="text-xs text-muted-2 font-semibold mt-0.5">
                  {p.periodStart.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} –{" "}
                  {p.periodEnd.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} · {Number(p.totalVolume)}{" "}
                  {p.station.fuelType === "BENZIN" ? "L" : "m³"}
                </div>
              </div>
              <div className="font-heading font-extrabold text-heading">{formatSom(Number(p.amount))}</div>
              <form action={markPaymentPaidAction}>
                <input type="hidden" name="paymentId" value={p.id} />
                <button
                  type="submit"
                  className="text-xs font-extrabold px-3 py-1.5 rounded-full"
                  style={{ background: STATUS_STYLE[p.status].bg, color: STATUS_STYLE[p.status].color }}
                >
                  {STATUS_STYLE[p.status].label}
                </button>
              </form>
            </div>
          ))}
          {payments.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Hali to&apos;lov yo&apos;q</p>}
        </Card>

        <Card className="p-5 flex flex-col gap-3">
          <div className="font-heading font-bold text-[15px] text-heading">+ Yangi to&apos;lov</div>
          <form action={addStationPaymentAction} className="flex flex-col gap-3">
            <select
              name="stationId"
              required
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-bold text-muted-2 mb-1">Davr boshi</div>
                <input
                  name="periodStart"
                  type="date"
                  required
                  className="w-full bg-page border-2 border-border rounded-lg px-2.5 py-2 text-xs font-bold text-heading outline-none focus:border-primary"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-2 mb-1">Davr oxiri</div>
                <input
                  name="periodEnd"
                  type="date"
                  required
                  className="w-full bg-page border-2 border-border rounded-lg px-2.5 py-2 text-xs font-bold text-heading outline-none focus:border-primary"
                />
              </div>
            </div>
            <input
              name="totalVolume"
              type="number"
              required
              min={1}
              step="0.1"
              placeholder="Jami hajm"
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
            />
            <input
              name="amount"
              type="number"
              required
              min={1}
              placeholder="Summa"
              className="bg-page border-2 border-primary rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
            />
            <button type="submit" className="bg-primary text-white rounded-xl py-3 font-extrabold text-sm">
              Saqlash ✓
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
