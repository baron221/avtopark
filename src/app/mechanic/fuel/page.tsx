import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatSom, formatMillions } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { getMechanicCostSummary } from "@/lib/ownerPayout";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";
import { FuelLogForm } from "./FuelLogForm";
import { AddStationForm } from "./AddStationForm";
import { deleteFuelLogAction } from "./actions";
import { deleteStationPaymentAction } from "./payments/actions";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: "#E4F5EC", color: "#1B9E6B", label: "Тўланди" },
  PARTIAL: { bg: "#EEF0F8", color: "#4F46E5", label: "Қисман тўланди" },
  PENDING: { bg: "#FFF3E0", color: "#B26A00", label: "Тўлов кутилмоқда" },
};

function formatPeriod(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default async function MechanicFuelPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "FUEL"))) redirect("/coming-soon");

  const [stations, payments, fuelLogs, vehicles, mechanicCostSummary] = await Promise.all([
    prisma.fuelStation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.stationPayment.findMany({ include: { station: true }, orderBy: { periodEnd: "desc" }, take: 10 }),
    prisma.fuelLog.findMany({
      include: { vehicle: true, driver: { include: { user: true } }, station: true },
      orderBy: { filledAt: "desc" },
      take: 15,
    }),
    prisma.vehicle.findMany({
      where: { status: { in: DISPATCHABLE_STATUSES } },
      include: { driver: { include: { user: true } } },
      orderBy: { plate: "asc" },
    }),
    getMechanicCostSummary(),
  ]);

  const grandTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const grandRemaining = payments.reduce((s, p) => s + Math.max(0, Number(p.amount) - Number(p.paidAmount)), 0);

  const vehicleOptions = vehicles.filter((v) => v.driver).map((v) => ({ id: v.id, plate: v.plate, driverName: v.driver!.user.fullName }));
  const stationOptions = stations.map((s) => ({ id: s.id, name: s.name, unitPrice: Number(s.unitPrice), fuelType: s.fuelType }));

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Ёқилғи ҳисоби</div>
        <div className="text-[13px] text-muted-2 font-semibold">
          {session.user.name} · {stations.length} та заправка билан шартнома · машиналар рўйхати ва таъмир ҳам
          механик зиммасида
        </div>
      </div>

      {/* Ёқилғи/мой учун эгадан олинган пул — эгасининг ўз ҳисобидан
          мексаникка тўғридан-тўғри тўланадиган харажатлар (буxгалтернинг
          ўз кассасига тегмайди — see ownerPayout.ts's getMechanicCostSummary
          own comment). */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard label="Ёқилғи учун сарфланган" value={formatMillions(mechanicCostSummary.fuelSpent)} />
        <KpiCard label="Мой учун сарфланган" value={formatMillions(mechanicCostSummary.oilSpent)} />
        <KpiCard label="Жами сарфланган" value={formatMillions(mechanicCostSummary.totalSpent)} />
        <KpiCard variant="primary" label="Эгасининг қолдиғи" value={formatMillions(mechanicCostSummary.balance)} />
      </div>

      <Card className="overflow-hidden">
        {/* Desktop */}
        <div className="hidden lg:grid grid-cols-[1.1fr_0.75fr_0.65fr_0.75fr_0.85fr_0.8fr_0.95fr_60px] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Заправка</div>
          <div>Шартнома</div>
          <div>Давр</div>
          <div>Ҳажм</div>
          <div>Сумма (сўм)</div>
          <div>Қолди</div>
          <div>Тўлов ҳолати</div>
          <div></div>
        </div>
        {payments.map((p) => {
          const style = STATUS_STYLE[p.status];
          const remaining = Math.max(0, Number(p.amount) - Number(p.paidAmount));
          return (
            <div
              key={p.id}
              className="hidden lg:grid grid-cols-[1.1fr_0.75fr_0.65fr_0.75fr_0.85fr_0.8fr_0.95fr_60px] gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="font-extrabold text-heading">{p.station.name}</div>
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
              <div className="flex items-center justify-end gap-1.5">
                <Link
                  href={`/mechanic/fuel/payments/${p.id}/edit`}
                  title="Таҳрирлаш"
                  className="text-muted-2 hover:text-primary text-base leading-none px-1"
                >
                  ✎
                </Link>
                <ConfirmDeleteButton
                  action={deleteStationPaymentAction}
                  id={p.id}
                  confirmText="Бу тўлов ёзувини ўчиришни тасдиқлайсизми?"
                  className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                />
              </div>
            </div>
          );
        })}

        {/* Mobile */}
        {payments.map((p) => {
          const style = STATUS_STYLE[p.status];
          const remaining = Math.max(0, Number(p.amount) - Number(p.paidAmount));
          return (
            <div key={p.id} className="flex flex-col gap-1.5 px-5 py-3.5 border-t border-row-divider text-sm lg:hidden">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-extrabold text-heading">{p.station.name}</div>
                  <div className="text-xs text-muted-2 font-semibold mt-0.5">
                    {p.station.contractNo} · {formatPeriod(p.periodStart, p.periodEnd)}
                  </div>
                </div>
                <span
                  className="text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: style.bg, color: style.color }}
                >
                  {style.label}
                </span>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="flex gap-3 text-xs font-bold flex-wrap">
                  <span className="text-muted-2">
                    Сумма: <span className="text-heading font-extrabold">{formatSom(Number(p.amount))}</span>
                  </span>
                  <span className="text-muted-2">
                    Қолди:{" "}
                    <span className={`font-extrabold ${remaining > 0 ? "text-danger" : "text-success"}`}>
                      {formatSom(remaining)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/mechanic/fuel/payments/${p.id}/edit`}
                    title="Таҳрирлаш"
                    className="text-muted-2 hover:text-primary text-base leading-none px-1"
                  >
                    ✎
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteStationPaymentAction}
                    id={p.id}
                    confirmText="Бу тўлов ёзувини ўчиришни тасдиқлайсизми?"
                    className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {payments.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳали тўлов ёзуви йўқ</p>}
        <div className="flex justify-between px-6 py-3.5 border-t border-row-divider bg-page">
          <span className="font-extrabold text-sm text-heading">Жами / Қолди</span>
          <span className="font-heading font-extrabold text-sm text-heading">
            {formatSom(grandTotal)} / <span className="text-danger">{formatSom(grandRemaining)}</span>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <Card className="overflow-hidden">
          <div className="px-6 py-3.5 font-heading font-bold text-[15px] text-heading">
            Қуйиш журнали (машина бўйича)
          </div>

          {/* Desktop */}
          {fuelLogs.map((f) => (
            <div
              key={f.id}
              className="hidden lg:grid grid-cols-[1fr_0.9fr_0.8fr_1.1fr_1fr_0.9fr_60px] gap-1 px-6 py-3 border-t border-row-divider items-center text-sm"
            >
              <div className="text-muted-2 font-bold">
                {f.filledAt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
              </div>
              <div className="font-extrabold text-primary font-heading">{f.vehicle.plate}</div>
              <div className="text-body font-semibold">{f.driver.user.fullName}</div>
              <div className="text-body font-semibold">{f.station.name}</div>
              <div className="font-bold text-heading">
                {Number(f.volume)} {f.station.fuelType === "BENZIN" ? "L" : "m³"}
              </div>
              <div className="font-extrabold text-heading text-right">{formatSom(Number(f.amount))}</div>
              <div className="flex items-center justify-end gap-1.5">
                <Link
                  href={`/mechanic/fuel/${f.id}/edit`}
                  title="Таҳрирлаш"
                  className="text-muted-2 hover:text-primary text-base leading-none px-1"
                >
                  ✎
                </Link>
                <ConfirmDeleteButton
                  action={deleteFuelLogAction}
                  id={f.id}
                  confirmText="Бу қуйиш ёзувини ўчиришни тасдиқлайсизми?"
                  className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                />
              </div>
            </div>
          ))}

          {/* Mobile */}
          {fuelLogs.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5 px-5 py-3 border-t border-row-divider text-sm lg:hidden">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-2 font-bold text-xs">
                    {f.filledAt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
                  </span>
                  <span className="font-extrabold text-primary font-heading">{f.vehicle.plate}</span>
                </div>
                <div className="font-extrabold text-heading">{formatSom(Number(f.amount))}</div>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-heading">{f.driver.user.fullName}</div>
                  <div className="text-muted-2 text-xs font-semibold mt-0.5">
                    {f.station.name} · {Number(f.volume)} {f.station.fuelType === "BENZIN" ? "L" : "m³"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/mechanic/fuel/${f.id}/edit`}
                    title="Таҳрирлаш"
                    className="text-muted-2 hover:text-primary text-base leading-none px-1"
                  >
                    ✎
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteFuelLogAction}
                    id={f.id}
                    confirmText="Бу қуйиш ёзувини ўчиришни тасдиқлайсизми?"
                    className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                  />
                </div>
              </div>
            </div>
          ))}

          {fuelLogs.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳали қуйиш ёзуви йўқ</p>}
        </Card>

        <div className="flex flex-col gap-4">
          <FuelLogForm vehicles={vehicleOptions} stations={stationOptions} />
          <AddStationForm />
        </div>
      </div>
    </div>
  );
}
