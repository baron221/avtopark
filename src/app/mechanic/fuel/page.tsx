import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { formatSom } from "@/lib/format";
import { FuelLogForm } from "./FuelLogForm";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: "#E4F5EC", color: "#1B9E6B", label: "To'landi" },
  PARTIAL: { bg: "#EEF0F8", color: "#4F46E5", label: "Qisman to'landi" },
  PENDING: { bg: "#FFF3E0", color: "#B26A00", label: "To'lov kutilmoqda" },
};

function formatPeriod(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default async function MechanicFuelPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  const [stations, payments, fuelLogs, vehicles] = await Promise.all([
    prisma.fuelStation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.stationPayment.findMany({ include: { station: true }, orderBy: { periodEnd: "desc" }, take: 10 }),
    prisma.fuelLog.findMany({
      include: { vehicle: true, driver: { include: { user: true } }, station: true },
      orderBy: { filledAt: "desc" },
      take: 15,
    }),
    prisma.vehicle.findMany({ where: { status: "ACTIVE" }, include: { driver: { include: { user: true } } }, orderBy: { plate: "asc" } }),
  ]);

  const grandTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const grandRemaining = payments.reduce((s, p) => s + Math.max(0, Number(p.amount) - Number(p.paidAmount)), 0);

  const vehicleOptions = vehicles.filter((v) => v.driver).map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver!.user.fullName }));
  const stationOptions = stations.map((s) => ({ id: s.id, name: s.name, unitPrice: Number(s.unitPrice), fuelType: s.fuelType }));

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Yoqilg&apos;i hisobi</div>
        <div className="text-[13px] text-muted-2 font-semibold">
          {session.user.name} · {stations.length} ta zapravka bilan shartnoma · mashinalar ro&apos;yxati va ta&apos;mir ham
          mexanik zimmasida
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.9fr_0.9fr_1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Zapravka</div>
          <div>Shartnoma</div>
          <div>Davr</div>
          <div>Hajm</div>
          <div>Summa (so&apos;m)</div>
          <div>Qoldi</div>
          <div>To&apos;lov holati</div>
        </div>
        {payments.map((p) => {
          const style = STATUS_STYLE[p.status];
          const remaining = Math.max(0, Number(p.amount) - Number(p.paidAmount));
          return (
            <div
              key={p.id}
              className="grid grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.9fr_0.9fr_1fr] gap-y-1 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="font-extrabold text-heading col-span-2 lg:col-span-1">{p.station.name}</div>
              <div className="text-primary font-extrabold">{p.station.contractNo}</div>
              <div className="text-muted-2 font-bold">{formatPeriod(p.periodStart, p.periodEnd)}</div>
              <div className="font-bold text-heading">
                {Number(p.totalVolume)} {p.station.fuelType === "BENZIN" ? "L" : "m³"}
              </div>
              <div className="font-heading font-extrabold text-heading">{formatSom(Number(p.amount))}</div>
              <div className={`font-bold ${remaining > 0 ? "text-danger" : "text-success"}`}>{formatSom(remaining)}</div>
              <div>
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ background: style.bg, color: style.color }}
                >
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
        {payments.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Hali to&apos;lov yozuvi yo&apos;q</p>}
        <div className="flex justify-between px-6 py-3.5 border-t border-row-divider bg-page">
          <span className="font-extrabold text-sm text-heading">Jami / Qoldi</span>
          <span className="font-heading font-extrabold text-sm text-heading">
            {formatSom(grandTotal)} / <span className="text-danger">{formatSom(grandRemaining)}</span>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <Card className="overflow-hidden">
          <div className="px-6 py-3.5 font-heading font-bold text-[15px] text-heading">
            Quyish jurnali (mashina bo&apos;yicha)
          </div>
          {fuelLogs.map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-2 lg:grid-cols-[1fr_0.9fr_0.8fr_1.1fr_1fr_0.7fr] gap-1 px-6 py-3 border-t border-row-divider items-center text-sm"
            >
              <div className="text-muted-2 font-bold">
                {f.filledAt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
              </div>
              <div className="font-extrabold text-primary font-heading">{f.vehicle.plate}</div>
              <div className="text-body font-semibold hidden lg:block">{f.driver.user.fullName}</div>
              <div className="text-body font-semibold hidden lg:block">{f.station.name}</div>
              <div className="font-bold text-heading">
                {Number(f.volume)} {f.station.fuelType === "BENZIN" ? "L" : "m³"}
              </div>
              <div className="font-extrabold text-heading text-right">{formatSom(Number(f.amount))}</div>
            </div>
          ))}
          {fuelLogs.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Hali quyish yozuvi yo&apos;q</p>}
        </Card>

        <FuelLogForm vehicles={vehicleOptions} stations={stationOptions} />
      </div>
    </div>
  );
}
