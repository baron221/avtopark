import { prisma } from "@/lib/prisma";
import { getOwnerDashboardVM, rangeForPeriod, type Period } from "@/lib/dashboard";

export type DriverReportRow = {
  driverId: string;
  name: string;
  plate: string;
  tripCount: number;
  planPct: number | null;
  salary: number;
  netContribution: number;
};

export async function getDriverReportRows(period: Period): Promise<DriverReportRow[]> {
  const [vm, drivers] = await Promise.all([
    getOwnerDashboardVM(period),
    prisma.driver.findMany({ include: { user: true, vehicle: true } }),
  ]);

  const { from, to } = rangeForPeriod(period, new Date());
  const vehicleIds = drivers.map((d) => d.vehicleId).filter((id): id is string => Boolean(id));

  const plans = vehicleIds.length
    ? await prisma.dailyPlan.groupBy({
        by: ["vehicleId"],
        where: { vehicleId: { in: vehicleIds }, planDate: { gte: from, lte: to } },
        _sum: { planAmount: true, paidAmount: true },
      })
    : [];
  const planByVehicle = new Map(plans.map((p) => [p.vehicleId, p]));
  const rowByVehicle = new Map(vm.vehicles.map((v) => [v.vehicleId, v]));

  return drivers
    .filter((d) => d.vehicleId)
    .map((d) => {
      const row = rowByVehicle.get(d.vehicleId!);
      const plan = planByVehicle.get(d.vehicleId!);
      const planAmount = Number(plan?._sum.planAmount ?? 0);
      const paidAmount = Number(plan?._sum.paidAmount ?? 0);

      return {
        driverId: d.id,
        name: d.user.fullName,
        plate: d.vehicle?.plate ?? "—",
        tripCount: row?.tripCount ?? 0,
        planPct: planAmount > 0 ? (paidAmount / planAmount) * 100 : null,
        salary: Number(d.user.baseSalary ?? 0),
        netContribution: row?.profit ?? 0,
      };
    })
    .sort((a, b) => b.netContribution - a.netContribution);
}
