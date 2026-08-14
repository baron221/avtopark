import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/access";
import { GpsHistoryView } from "@/components/gps/GpsHistoryView";
import { GpsTripComparisonCard } from "@/components/gps/GpsTripComparisonCard";
import { getGpsTripComparisonRows } from "@/lib/gpsTripComparison";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined): string {
  if (value && DATE_RE.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

export default async function MechanicGpsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) {
    redirect("/coming-soon");
  }

  const { vehicleId, date } = await searchParams;
  const dateStr = parseDateParam(date);
  const tripComparisonRows = await getGpsTripComparisonRows(dateStr);

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="font-heading font-bold text-xl text-heading">GPS йўл тарихи</div>
        <Link
          href="/mechanic/gps"
          className="inline-flex items-center bg-page border border-border text-muted-2 rounded-lg px-3 py-1.5 text-[13px] font-bold hover:border-primary hover:text-primary hover:bg-primary-tint transition-colors"
        >
          ← GPS кузатув
        </Link>
      </div>

      <GpsHistoryView basePath="/mechanic/gps/history" vehicleId={vehicleId} dateStr={dateStr} />
      <GpsTripComparisonCard rows={tripComparisonRows} windowLabel={`${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)}гача 7 кун`} />
    </div>
  );
}
