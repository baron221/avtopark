import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { hasModuleAccess } from "@/lib/access";
import { ROLE_HOME } from "@/lib/roleHome";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function FleetShiftsViewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const allowed = await hasModuleAccess(session.user.role, "SHIFTS_VIEW");
  if (!allowed) redirect(ROLE_HOME[session.user.role] ?? "/coming-soon");

  const { date: dateParam } = await searchParams;
  const date = dateParam || todayStr();
  const shiftDate = new Date(`${date}T00:00:00`);

  const [vehicles, drivers, shifts] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: { plate: "asc" } }),
    prisma.driver.findMany({ include: { user: true } }),
    prisma.shift.findMany({ where: { shiftDate } }),
  ]);

  const driverNameById = new Map(drivers.map((d) => [d.id, d.user.fullName]));
  const shiftMap = new Map<string, { morning?: string; evening?: string }>();
  for (const s of shifts) {
    const entry = shiftMap.get(s.vehicleId) ?? {};
    if (s.shiftType === "MORNING") entry.morning = s.driverId;
    else entry.evening = s.driverId;
    shiftMap.set(s.vehicleId, entry);
  }

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Smenalar · {date}</div>
          <div className="text-[13px] text-muted-2 font-semibold">Faqat ko&apos;rish uchun ochilgan</div>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex gap-2 items-center">
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="bg-card border-2 border-border rounded-xl px-3 py-2 text-sm font-bold text-heading outline-none focus:border-primary"
            />
            <button type="submit" className="bg-primary-tint text-primary text-[13px] font-extrabold px-4 py-2 rounded-xl">
              Ko&apos;rish
            </button>
          </form>
          <Link href={ROLE_HOME[session.user.role] ?? "/"} className="text-[13px] font-bold text-muted-2 hover:text-primary">
            ← Bosh sahifa
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_1.4fr_1.4fr_0.8fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Mashina</div>
          <div>Ertalabki smena (06:00–14:00)</div>
          <div>Kechki smena (14:00–22:00)</div>
          <div>Holat</div>
        </div>
        {vehicles.map((v) => {
          const entry = shiftMap.get(v.id) ?? {};
          return (
            <div
              key={v.id}
              className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1.4fr_0.8fr] gap-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-primary-tint rounded-md px-2 py-0.5 font-extrabold text-xs text-primary font-heading">
                  {v.plate}
                </div>
                <span className="font-semibold text-heading lg:hidden">{v.model}</span>
              </div>
              <div className="text-body font-semibold">
                {entry.morning ? (driverNameById.get(entry.morning) ?? "—") : "— tayinlanmagan —"}
              </div>
              <div className="text-body font-semibold">
                {entry.evening ? (driverNameById.get(entry.evening) ?? "—") : "— tayinlanmagan —"}
              </div>
              <div>
                <StatusPill status={v.status} />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
