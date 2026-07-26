import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ShiftSelect } from "@/app/admin/shifts/ShiftSelect";
import { assignShiftAction } from "./actions";

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MechanicShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  const { month: monthParam } = await searchParams;
  const monthStr = monthParam || currentMonthStr();
  const month = new Date(`${monthStr}-01T00:00:00Z`);

  const [vehicles, drivers, shifts] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: { plate: "asc" } }),
    prisma.driver.findMany({ include: { user: true, vehicle: true }, orderBy: { user: { fullName: "asc" } } }),
    prisma.shift.findMany({ where: { month } }),
  ]);

  const shiftByVehicle = new Map(shifts.map((s) => [s.vehicleId, s.driverId]));

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Smenalar · {monthStr}</div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Har mashinaga oy uchun bitta haydovchi (kunlik to&apos;liq smena) tayinlanadi
          </div>
        </div>
        <form className="flex gap-2 items-center">
          <input
            type="month"
            name="month"
            defaultValue={monthStr}
            className="bg-card border-2 border-border rounded-xl px-3 py-2 text-sm font-bold text-heading outline-none focus:border-primary"
          />
          <button type="submit" className="bg-primary-tint text-primary text-[13px] font-extrabold px-4 py-2 rounded-xl">
            Ko&apos;rish
          </button>
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_2fr_0.8fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Mashina</div>
          <div>Haydovchi (shu oy uchun)</div>
          <div>Holat</div>
        </div>
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_0.8fr] gap-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-primary-tint rounded-md px-2 py-0.5 font-extrabold text-xs text-primary font-heading">
                {v.plate}
              </div>
              <span className="font-semibold text-heading lg:hidden">{v.model}</span>
            </div>
            <form action={assignShiftAction} className="flex items-center gap-2">
              <input type="hidden" name="vehicleId" value={v.id} />
              <input type="hidden" name="month" value={monthStr} />
              <ShiftSelect
                name="driverId"
                defaultValue={shiftByVehicle.get(v.id) ?? ""}
                className="w-full max-w-[320px] bg-card border-2 border-border rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary"
              >
                <option value="">— tayinlanmagan —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user.fullName}
                    {d.vehicle ? ` · ${d.vehicle.plate}` : " · bo'sh"}
                  </option>
                ))}
              </ShiftSelect>
            </form>
            <div>
              <StatusPill status={v.status} />
            </div>
          </div>
        ))}
        {vehicles.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Mashina yo&apos;q</p>}
      </Card>
    </div>
  );
}
