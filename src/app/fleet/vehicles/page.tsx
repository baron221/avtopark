import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { getOwnerDashboardVM } from "@/lib/dashboard";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { ROLE_HOME } from "@/lib/roleHome";

export default async function FleetVehiclesViewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const allowed = await hasModuleAccess(session.user.role, "VEHICLES_VIEW");
  if (!allowed) redirect(ROLE_HOME[session.user.role] ?? "/coming-soon");

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const vm = await getOwnerDashboardVM("MONTH");
  const skip = paginationSkip(page);
  const vehicles = vm.vehicles.slice(skip, skip + DEFAULT_PAGE_SIZE);
  const pages = totalPages(vm.vehicles.length);

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Mashinalar</div>
          <div className="text-[13px] text-muted-2 font-semibold">Faqat ko&apos;rish uchun ochilgan</div>
        </div>
        <Link href={ROLE_HOME[session.user.role] ?? "/"} className="text-[13px] font-bold text-muted-2 hover:text-primary">
          ← Bosh sahifa
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.1fr_1fr_0.7fr_1.2fr_0.9fr_0.9fr_0.8fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Raqam</div>
          <div>Model</div>
          <div>Turi</div>
          <div>Haydovchi</div>
          <div>Tushum</div>
          <div>Foyda</div>
          <div>Holat</div>
        </div>
        {vehicles.map((v) => (
          <div
            key={v.vehicleId}
            className="grid grid-cols-2 lg:grid-cols-[1.1fr_1fr_0.7fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-y-1 gap-x-2 px-6 py-3.5 border-t border-row-divider items-center text-sm"
          >
            <div className="font-extrabold text-primary font-heading">{v.plate}</div>
            <div className="font-semibold text-heading">{v.model}</div>
            <div className="text-muted font-semibold">{v.type === "AVTOBUS" ? "Avtobus" : "Furgon"}</div>
            <div className="text-body font-semibold col-span-2 lg:col-span-1">{v.driverName}</div>
            <div className="font-bold text-heading">{formatSom(v.income)}</div>
            <div className="font-extrabold text-success">{formatSom(v.profit)}</div>
            <div>
              <StatusPill status={v.status} />
            </div>
          </div>
        ))}
        {vehicles.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Hali mashina yo&apos;q</p>}
        <Pagination page={page} totalPages={pages} basePath="/fleet/vehicles" />
      </Card>
    </div>
  );
}
