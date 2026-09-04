import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { DatePicker } from "@/components/ui/DatePicker";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { rangeForPeriod, type Period } from "@/lib/dashboard";
import { deleteVehicleExpenseAction } from "../vehicles/[id]/actions";

const CATEGORY_LABELS: Record<string, string> = {
  FUEL: "Ёқилғи",
  REPAIR: "Таъмирлаш",
  SALARY: "Маош",
  INSURANCE: "Суғурта",
  TAX: "Солиқ",
  TOLL: "Йўл ҳақи",
  OTHER: "Бошқа",
};

function isPeriod(value: string | undefined): value is Period {
  return value === "DAY" || value === "WEEK" || value === "MONTH";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined): { date: Date; dateStr: string } {
  if (value && DATE_RE.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return { date: parsed, dateStr: value };
  }
  const today = new Date();
  return { date: today, dateStr: today.toISOString().slice(0, 10) };
}

/** Every vehicle Expense the mechanic has entered (any category — REPAIR/
 * oil changes, but also fuel/insurance/tax/toll/other one-off costs), fleet-
 * wide — /mechanic/vehicles/[id]'s own "Охирги харажатлар" list is the same
 * data but scoped to a single vehicle, so there was no way to see "everything
 * I've spent recently" across the whole fleet in one place. */
export default async function MechanicExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES"))) {
    redirect("/coming-soon");
  }

  const { period: periodParam, date: dateParam } = await searchParams;
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const { date, dateStr } = parseDateParam(dateParam);
  const { from, to } = rangeForPeriod(period, date);

  const expenses = await prisma.expense.findMany({
    where: { expenseDate: { gte: from, lte: to } },
    include: { vehicle: { select: { plate: true } } },
    orderBy: { expenseDate: "desc" },
  });
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Харажатлар</div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Барча машиналар бўйича киритилган харажатлар (ёқилғи, таъмирлаш ва бошқа)
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <DatePicker basePath="/mechanic/expenses" period={period} value={dateStr} />
          <PeriodToggle active={period} basePath="/mechanic/expenses" date={dateStr} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden lg:grid grid-cols-[0.8fr_1fr_1fr_1.6fr_0.9fr_60px] px-5 py-2.5 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Сана</div>
          <div>Машина</div>
          <div>Тоифа</div>
          <div>Изоҳ</div>
          <div>Сумма</div>
          <div></div>
        </div>
        {expenses.map((e) => (
          <div
            key={e.id}
            className="hidden lg:grid grid-cols-[0.8fr_1fr_1fr_1.6fr_0.9fr_60px] gap-x-2 px-5 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="text-muted-2 font-bold">
              {e.expenseDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
            </div>
            <div>
              <Link href={`/mechanic/vehicles/${e.vehicleId}`} className="font-extrabold text-primary hover:underline">
                {e.vehicle.plate}
              </Link>
            </div>
            <div>
              <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                {CATEGORY_LABELS[e.category] ?? e.category}
              </span>
            </div>
            <div className="text-body font-semibold min-w-0 break-words">{e.note ?? "—"}</div>
            <div className="font-extrabold text-danger">−{formatSom(Number(e.amount))}</div>
            <ConfirmDeleteButton
              action={deleteVehicleExpenseAction}
              id={e.id}
              confirmText="Бу харажатни ўчиришни тасдиқлайсизми?"
              className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
            />
          </div>
        ))}

        {/* Mobile */}
        <div className="lg:hidden">
          {expenses.map((e) => (
            <div key={e.id} className="flex flex-col gap-1.5 px-5 py-3 border-t border-row-divider text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-2 font-bold text-xs">
                    {e.expenseDate.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
                  </span>
                  <Link href={`/mechanic/vehicles/${e.vehicleId}`} className="font-extrabold text-primary">
                    {e.vehicle.plate}
                  </Link>
                  <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {CATEGORY_LABELS[e.category] ?? e.category}
                  </span>
                </div>
                <div className="font-extrabold text-danger whitespace-nowrap">−{formatSom(Number(e.amount))}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-body font-semibold min-w-0 break-words">{e.note ?? "—"}</div>
                <ConfirmDeleteButton
                  action={deleteVehicleExpenseAction}
                  id={e.id}
                  confirmText="Бу харажатни ўчиришни тасдиқлайсизми?"
                  className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1 shrink-0"
                />
              </div>
            </div>
          ))}
        </div>

        {expenses.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Бу даврда харажат йўқ</p>}
        <div className="flex justify-between px-5 py-3.5 border-t border-row-divider bg-page">
          <span className="font-extrabold text-sm text-heading">Жами</span>
          <span className="font-heading font-extrabold text-sm text-danger">−{formatSom(total)}</span>
        </div>
      </Card>
    </div>
  );
}
