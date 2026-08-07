import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { addStationPaymentInstallmentAction, addStationPaymentAction, deleteStationPaymentAction } from "./actions";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: "#E4F5EC", color: "#1B9E6B", label: "Тўланди" },
  PARTIAL: { bg: "#EEF0F8", color: "#4F46E5", label: "Қисман тўланди" },
  PENDING: { bg: "#FFF3E0", color: "#B26A00", label: "Тўлов кутилмоқда" },
};

export default async function StationPaymentsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "FUEL"))) redirect("/coming-soon");

  const [payments, stations] = await Promise.all([
    prisma.stationPayment.findMany({ include: { station: true }, orderBy: { periodEnd: "desc" } }),
    prisma.fuelStation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="font-heading font-bold text-xl text-heading">Заправка тўловлари</div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="overflow-hidden">
          {payments.map((p) => {
            const remaining = Math.max(0, Number(p.amount) - Number(p.paidAmount));
            return (
              <div
                key={p.id}
                className="flex flex-col gap-2.5 px-5 py-3.5 border-t border-row-divider first:border-t-0 text-sm"
              >
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <div className="font-extrabold text-heading">{p.station.name}</div>
                    <div className="text-xs text-muted-2 font-semibold mt-0.5">
                      {p.periodStart.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} –{" "}
                      {p.periodEnd.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} ·{" "}
                      {Number(p.totalVolume)} {p.station.fuelType === "BENZIN" ? "L" : "m³"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-extrabold px-3 py-1 rounded-full whitespace-nowrap"
                      style={{ background: STATUS_STYLE[p.status].bg, color: STATUS_STYLE[p.status].color }}
                    >
                      {STATUS_STYLE[p.status].label}
                    </span>
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

                <div className="flex gap-4 text-xs font-bold flex-wrap">
                  <span className="text-muted-2">
                    Жами: <span className="text-heading font-extrabold">{formatSom(Number(p.amount))}</span>
                  </span>
                  <span className="text-muted-2">
                    Тўланди: <span className="text-success font-extrabold">{formatSom(Number(p.paidAmount))}</span>
                  </span>
                  <span className="text-muted-2">
                    Қолди: <span className="text-danger font-extrabold">{formatSom(remaining)}</span>
                  </span>
                </div>

                {remaining > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <form action={addStationPaymentInstallmentAction} className="flex gap-2">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <MoneyInput
                        name="amount"
                        placeholder="Сумма"
                        className="w-32 bg-page border-2 border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
                      />
                      <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-extrabold">
                        Тўлов қўшиш
                      </button>
                    </form>
                    <form action={addStationPaymentInstallmentAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="amount" value={remaining} />
                      <button type="submit" className="bg-success-tint text-success rounded-lg px-3 py-1.5 text-xs font-extrabold">
                        Тўлиқ тўлаш ({formatSom(remaining)})
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
          {payments.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Ҳали тўлов йўқ</p>}
        </Card>

        <Card className="p-5 flex flex-col gap-3">
          <div className="font-heading font-bold text-[15px] text-heading">+ Янги тўлов</div>
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
                <div className="text-xs font-bold text-muted-2 mb-1">Давр боши</div>
                <input
                  name="periodStart"
                  type="date"
                  required
                  className="w-full bg-page border-2 border-border rounded-lg px-2.5 py-2 text-xs font-bold text-heading outline-none focus:border-primary"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-2 mb-1">Давр охири</div>
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
              placeholder="Жами ҳажм"
              className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
            />
            <MoneyInput
              name="amount"
              required
              placeholder="Сумма"
              className="bg-page border-2 border-primary rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
            />
            <button type="submit" className="bg-primary text-white rounded-xl py-3 font-extrabold text-sm">
              Сақлаш ✓
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
