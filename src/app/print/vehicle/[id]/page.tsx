import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/access";
import { getVehicleReport } from "@/lib/vehicleReport";
import { formatSom } from "@/lib/format";
import type { Period } from "@/lib/dashboard";
import { PrintTrigger } from "./PrintTrigger";

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

export default async function VehicleReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) {
    redirect("/coming-soon");
  }

  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";

  const report = await getVehicleReport(id, period);
  if (!report) notFound();

  return (
    <div className="max-w-[420px] mx-auto p-8 text-black bg-white">
      <PrintTrigger />
      <h1 className="text-center text-xl font-extrabold mb-1">{report.plate}</h1>
      <p className="text-center text-sm text-gray-600 mb-4">
        {report.periodLabel} · {report.rangeLabel}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-black px-3 py-2 text-left">Мақсад</th>
            <th className="border border-black px-3 py-2 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {report.expenseLines.map((l, i) => (
            <tr key={i}>
              <td className="border border-black px-3 py-2">{l.label}</td>
              <td className="border border-black px-3 py-2 text-right">{formatSom(l.amount)}</td>
            </tr>
          ))}
          {report.expenseLines.length === 0 && (
            <tr>
              <td className="border border-black px-3 py-2" colSpan={2}>
                Бу даврда харажат ёзилмаган
              </td>
            </tr>
          )}
          <tr>
            <td className="border border-black px-3 py-2 font-extrabold text-red-700">Жами расход</td>
            <td className="border border-black px-3 py-2 text-right font-extrabold text-red-700">
              {formatSom(report.totalExpense)}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="h-3 border-none" />
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-extrabold bg-yellow-100">{report.rangeLabel} тушум</td>
            <td className="border border-black px-3 py-2 text-right font-extrabold bg-yellow-100">
              {formatSom(report.income)}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-2 font-extrabold">Фойда</td>
            <td className="border border-black px-3 py-2 text-right font-extrabold">{formatSom(report.profit)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
