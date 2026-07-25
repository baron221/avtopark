import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { formatSom } from "@/lib/format";

const FILTERS = [
  { key: "ALL", label: "Barchasi" },
  { key: "ACTIVE", label: "Liniyada" },
  { key: "RENTED", label: "Ijarada" },
  { key: "REPAIR", label: "Ta'mirda" },
] as const;

export default async function MechanicVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC") redirect("/coming-soon");

  const { status: statusParam, page: pageParam } = await searchParams;
  const status = FILTERS.some((f) => f.key === statusParam) ? statusParam! : "ALL";
  const page = parsePage(pageParam);

  const vm = await getOwnerDashboardVM("MONTH");
  const filteredVehicles = status === "ALL" ? vm.vehicles : vm.vehicles.filter((v) => v.status === status);
  const skip = paginationSkip(page);
  const vehicles = filteredVehicles.slice(skip, skip + DEFAULT_PAGE_SIZE);
  const pages = totalPages(filteredVehicles.length);
  const counts = {
    ALL: vm.vehicles.length,
    ACTIVE: vm.vehicles.filter((v) => v.status === "ACTIVE").length,
    RENTED: vm.vehicles.filter((v) => v.status === "RENTED").length,
    REPAIR: vm.vehicles.filter((v) => v.status === "REPAIR").length,
  };

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="font-heading font-bold text-xl text-heading">Mashinalar</div>
        <Link
          href="/mechanic/vehicles/new"
          className="bg-primary text-white rounded-[10px] px-[18px] py-2.5 font-extrabold text-[13px]"
        >
          + Mashina qo&apos;shish
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/mechanic/vehicles?status=${f.key}`}
            className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
              status === f.key ? "bg-primary text-white" : "bg-card border border-border text-muted"
            }`}
          >
            {f.label} · {counts[f.key]}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.1fr_1fr_0.7fr_0.7fr_1.2fr_0.9fr_0.9fr_0.8fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Raqam</div>
          <div>Model</div>
          <div>Turi</div>
          <div>Rejim</div>
          <div>Haydovchi</div>
          <div>Tushum</div>
          <div>Foyda</div>
          <div>Holat</div>
        </div>
        {vehicles.map((v) => (
          <Link
            key={v.vehicleId}
            href={`/mechanic/vehicles/${v.vehicleId}`}
            className="grid grid-cols-2 lg:grid-cols-[1.1fr_1fr_0.7fr_0.7fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-y-1 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm hover:bg-page"
          >
            <div className="font-extrabold text-primary font-heading">{v.plate}</div>
            <div className="font-semibold text-heading">{v.model}</div>
            <div className="text-muted font-semibold">{v.type === "AVTOBUS" ? "Avtobus" : "Furgon"}</div>
            <div className="text-muted font-bold">
              {v.incomeSource === "TRIPS" ? "Reys" : v.incomeSource === "PLAN" ? "Plan" : "Ijara"}
            </div>
            <div className="text-body font-semibold col-span-2 lg:col-span-1">{v.driverName}</div>
            <div className="font-bold text-heading">{formatSom(v.income)}</div>
            <div className="font-extrabold text-success">{formatSom(v.profit)}</div>
            <div>
              <StatusPill status={v.status} />
            </div>
          </Link>
        ))}
        {vehicles.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Bu filtrga mos mashina yo&apos;q</p>}
        <Pagination page={page} totalPages={pages} basePath="/mechanic/vehicles" params={{ status }} />
      </Card>
    </div>
  );
}
