import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatSom } from "@/lib/format";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { StatusSelect } from "./StatusSelect";
import { ExpenseForm } from "./ExpenseForm";
import { DriverSelect } from "./DriverSelect";

const CATEGORY_LABELS: Record<string, string> = {
  FUEL: "Yoqilg'i",
  REPAIR: "Ta'mirlash",
  SALARY: "Maosh",
  INSURANCE: "Sug'urta",
  TAX: "Soliq",
  TOLL: "Yo'l haqi",
  OTHER: "Boshqa",
};

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  const { id } = await params;

  const [vehicle, vm, expenses, drivers] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id }, include: { driver: { include: { user: true } } } }),
    getOwnerDashboardVM("MONTH"),
    prisma.expense.findMany({ where: { vehicleId: id }, orderBy: { expenseDate: "desc" }, take: 10 }),
    prisma.driver.findMany({ include: { user: true, vehicle: true }, orderBy: { user: { fullName: "asc" } } }),
  ]);

  if (!vehicle) notFound();

  const row = vm.vehicles.find((v) => v.vehicleId === id);
  const driverOptions = drivers.map((d) => ({
    id: d.id,
    name: d.user.fullName,
    currentPlate: d.vehicle?.plate ?? null,
  }));

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3.5 flex-wrap">
          <Link href="/mechanic/vehicles" className="text-[13px] font-bold text-muted-2 hover:text-primary">
            ← Mashinalar
          </Link>
          <div className="font-heading font-bold text-xl text-heading">
            {vehicle.plate} · {vehicle.model}
          </div>
          <StatusSelect vehicleId={vehicle.id} status={vehicle.status} />
          <Link
            href={`/mechanic/vehicles/${vehicle.id}/edit`}
            className="bg-page text-heading text-xs font-extrabold px-3 py-1.5 rounded-lg border border-border"
          >
            Tahrirlash
          </Link>
        </div>
        <DriverSelect vehicleId={vehicle.id} currentDriverId={vehicle.driver?.id ?? null} drivers={driverOptions} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={`Tushum · ${vm.periodLabel}`} value={formatSom(row?.income ?? 0)} />
        <KpiCard label={`Xarajat · ${vm.periodLabel}`} value={formatSom(row?.expense ?? 0)} hintColor="danger" />
        <KpiCard variant="primary" label={`Sof foyda · ${vm.periodLabel}`} value={formatSom(row?.profit ?? 0)} />
        <KpiCard label={`Reyslar · ${vm.periodLabel}`} value={String(row?.tripCount ?? 0)} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex justify-between items-center px-6 py-3.5">
          <div className="font-heading font-bold text-base text-heading">Oxirgi xarajatlar</div>
        </div>
        <div className="px-6 pb-4">
          <ExpenseForm vehicleId={vehicle.id} />
        </div>
        {expenses.map((e) => (
          <div
            key={e.id}
            className="grid grid-cols-[0.6fr_0.9fr_2fr_1fr] px-6 py-3 border-t border-row-divider items-center text-sm gap-2"
          >
            <div className="text-muted-2 font-bold">
              {e.expenseDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
            </div>
            <div>
              <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full">
                {CATEGORY_LABELS[e.category] ?? e.category}
              </span>
            </div>
            <div className="text-body font-semibold">{e.note ?? "—"}</div>
            <div className="font-extrabold text-heading text-right">−{formatSom(Number(e.amount))}</div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Hali xarajat yo&apos;q</p>}
      </Card>
    </div>
  );
}
