import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { PeriodToggle } from "@/components/ui/PeriodToggle";
import { DatePicker } from "@/components/ui/DatePicker";
import { DEFAULT_PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/paginate";
import { formatSom } from "@/lib/format";
import { hasModuleAccess } from "@/lib/access";
import { rangeForPeriod, type Period } from "@/lib/dashboard";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { deleteExpenseAction } from "./actions";
import type { Point, StaffExpensePoint } from "@prisma/client";

const POINT_LABELS: Record<string, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
  YOLDA: "Йўлда",
  ISHXONA: "Ишхона",
  VEHICLE: "Машина",
  ADVANCE: "Аванс",
};

const CATEGORY_LABELS: Record<string, string> = {
  STOYANKA: "Стоянка",
  OZIQ_OVQAT: "Озиқ-овқат",
  OBED: "Обед",
  BOSHQA: "Бошқа",
};

// Generic vehicle Expense (mechanic-entered — repair/fuel/salary/...) has
// its own category enum, separate from StaffExpenseCategory above.
const VEHICLE_CATEGORY_LABELS: Record<string, string> = {
  FUEL: "Ёқилғи",
  REPAIR: "Таъмирлаш",
  SALARY: "Маош",
  INSURANCE: "Суғурта",
  TAX: "Солиқ",
  TOLL: "Йўл ҳақи",
  OTHER: "Бошқа",
};

type ExpenseFilter = StaffExpensePoint | "VEHICLE" | "ADVANCE";

const POINT_FILTERS: { value?: ExpenseFilter; label: string }[] = [
  { value: undefined, label: "Барчаси" },
  { value: "FARGONA", label: "Фарғона" },
  { value: "QUVA", label: "Қува" },
  { value: "YOLDA", label: "Йўлда" },
  { value: "ISHXONA", label: "Ишхона" },
  { value: "VEHICLE", label: "Машина" },
  { value: "ADVANCE", label: "Аванс" },
];

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

function isExpenseFilter(value: string | undefined): value is ExpenseFilter {
  return (
    value === "FARGONA" ||
    value === "QUVA" ||
    value === "YOLDA" ||
    value === "ISHXONA" ||
    value === "VEHICLE" ||
    value === "ADVANCE"
  );
}

function rangeLabel(period: Period, from: Date, to: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
  if (period === "DAY") return fmt(from);
  if (period === "WEEK") return `${fmt(from)} – ${fmt(to)}`;
  return from.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
}

export default async function AccountantExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; period?: string; date?: string; point?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT" && !(await hasModuleAccess(session.user.role, "PAYROLL"))) {
    redirect("/coming-soon");
  }

  const { page: pageParam, period: periodParam, date: dateParam, point: pointParam } = await searchParams;
  const page = parsePage(pageParam);
  const period: Period = isPeriod(periodParam) ? periodParam : "MONTH";
  const { date, dateStr } = parseDateParam(dateParam);
  const point = isExpenseFilter(pointParam) ? pointParam : undefined;
  const { from, to } = rangeForPeriod(period, date);

  // Four separate models feed this one page, none of which alone matches
  // the report page's "Жами харажат": StaffExpense (dispatcher/accountant
  // point expenses), Lunch (Обед routes here instead of StaffExpense — see
  // ExpenseForm.tsx), the generic vehicle Expense (mechanic-entered
  // repair/fuel/salary/... — see mechanic/vehicles/[id]/actions.ts), and
  // Advance (a driver/staff advance against salary — not a point expense at
  // all, listed here purely for visibility/tracking, same as this page's
  // other categories). Filter semantics: FARGONA/QUVA show StaffExpense+
  // Lunch for that point; YOLDA/ISHXONA show StaffExpense only (Lunch/
  // vehicle Expense/Advance can't have those points); VEHICLE shows only
  // the generic Expense; ADVANCE shows only advances; "Барчаси" shows
  // everything.
  const staffPoint: StaffExpensePoint | undefined =
    point && point !== "VEHICLE" && point !== "ADVANCE" ? point : undefined;
  const lunchPoint: Point | undefined = point === "FARGONA" || point === "QUVA" ? point : undefined;
  const includeLunch = point === undefined || point === "FARGONA" || point === "QUVA";
  const includeVehicleExpense = point === undefined || point === "VEHICLE";
  const includeStaffExpense = point !== "VEHICLE" && point !== "ADVANCE";
  const includeAdvance = point === undefined || point === "ADVANCE";

  const [staffExpenses, lunches, vehicleExpenses, advances, staffByPoint, lunchByPoint, vehicleExpenseAgg, advanceAgg, users] =
    await Promise.all([
      includeStaffExpense
        ? prisma.staffExpense.findMany({
            where: { expenseDate: { gte: from, lte: to }, ...(staffPoint ? { point: staffPoint } : {}) },
            orderBy: { expenseDate: "desc" },
          })
        : Promise.resolve([]),
      includeLunch
        ? prisma.lunch.findMany({
            where: { lunchDate: { gte: from, lte: to }, ...(lunchPoint ? { point: lunchPoint } : {}) },
            include: { user: true },
            orderBy: { lunchDate: "desc" },
          })
        : Promise.resolve([]),
      includeVehicleExpense
        ? prisma.expense.findMany({
            where: { expenseDate: { gte: from, lte: to } },
            include: { vehicle: true },
            orderBy: { expenseDate: "desc" },
          })
        : Promise.resolve([]),
      includeAdvance
        ? prisma.advance.findMany({
            where: { givenDate: { gte: from, lte: to } },
            include: { user: true },
            orderBy: { givenDate: "desc" },
          })
        : Promise.resolve([]),
      prisma.staffExpense.groupBy({
        by: ["point"],
        where: { expenseDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.lunch.groupBy({
        by: ["point"],
        where: { lunchDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: from, lte: to } } }),
      prisma.advance.aggregate({ _sum: { amount: true }, where: { givenDate: { gte: from, lte: to } } }),
      prisma.user.findMany({ select: { id: true, fullName: true } }),
    ]);

  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const pointTotal: Record<string, number> = { FARGONA: 0, QUVA: 0, YOLDA: 0, ISHXONA: 0, VEHICLE: 0, ADVANCE: 0 };
  for (const row of staffByPoint) pointTotal[row.point] += Number(row._sum.amount ?? BigInt(0));
  for (const row of lunchByPoint) pointTotal[row.point] += Number(row._sum.amount ?? BigInt(0));
  pointTotal.VEHICLE = Number(vehicleExpenseAgg._sum.amount ?? BigInt(0));
  pointTotal.ADVANCE = Number(advanceAgg._sum.amount ?? BigInt(0));
  const grandTotal = Object.values(pointTotal).reduce((s, v) => s + v, 0);

  type ExpenseRow = {
    id: string;
    editable: boolean;
    time: Date;
    personName: string;
    note: string | null;
    point: string;
    category: string;
    amount: number;
  };
  const rows: ExpenseRow[] = [
    ...staffExpenses.map((e) => ({
      id: e.id,
      editable: true,
      time: e.expenseDate,
      personName: nameById.get(e.userId) ?? "—",
      note: e.note,
      point: e.point,
      category: CATEGORY_LABELS[e.category] ?? e.category,
      amount: Number(e.amount),
    })),
    ...vehicleExpenses.map((e) => ({
      id: e.id,
      editable: false,
      time: e.expenseDate,
      personName: e.vehicle.plate,
      note: e.note,
      point: "VEHICLE",
      category: VEHICLE_CATEGORY_LABELS[e.category] ?? e.category,
      amount: Number(e.amount),
    })),
    ...lunches.map((l) => ({
      id: l.id,
      editable: false,
      time: l.lunchDate,
      personName: l.user.fullName,
      note: "Тушлик",
      point: l.point,
      category: "Обед",
      amount: Number(l.amount),
    })),
    ...advances.map((a) => ({
      id: a.id,
      editable: false,
      time: a.givenDate,
      personName: a.user.fullName,
      note: null,
      point: "ADVANCE",
      category: "Аванс",
      amount: Number(a.amount),
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  const pages = totalPages(rows.length);
  const pageRows = rows.slice(paginationSkip(page), paginationSkip(page) + DEFAULT_PAGE_SIZE);
  const extraParams = point ? { point } : undefined;
  const pageParams = { period, date: dateStr, ...(point ? { point } : {}) };

  return (
    <div className="max-w-[1000px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="font-heading font-bold text-xl text-heading">Расходлар · {rangeLabel(period, from, to)}</div>
          <div className="text-[13px] text-muted-2 font-semibold">
            Диспетчерлар (Фарғона, Қува), бухгалтер (Йўлда, Ишхона) ва механик (Машина) киритган расходлар
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <DatePicker basePath="/accountant/expenses" period={period} value={dateStr} extraParams={extraParams} />
          <PeriodToggle active={period} basePath="/accountant/expenses" date={dateStr} extraParams={extraParams} />
          <Link
            href={`/accountant/expenses/export/excel?period=${period}&date=${dateStr}${point ? `&point=${point}` : ""}`}
            className="bg-card border border-border text-body rounded-[10px] px-4 py-2.5 font-extrabold text-[13px]"
          >
            ⬇ Excel
          </Link>
          <Link
            href="/accountant/expenses/new"
            className="bg-danger text-white rounded-[10px] px-[18px] py-2.5 font-extrabold text-[13px]"
          >
            + Бошқа расход
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {POINT_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={`/accountant/expenses?period=${period}&date=${dateStr}${f.value ? `&point=${f.value}` : ""}`}
            scroll={false}
            className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold ${
              point === f.value ? "bg-primary text-white" : "bg-card border border-border text-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-xs font-bold text-muted-2 uppercase">Фарғона</div>
          <div className="font-heading font-extrabold text-xl text-danger mt-1">−{formatSom(pointTotal.FARGONA)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-muted-2 uppercase">Қува</div>
          <div className="font-heading font-extrabold text-xl text-danger mt-1">−{formatSom(pointTotal.QUVA)}</div>
        </Card>
        {pointTotal.YOLDA > 0 && (
          <Card className="p-4">
            <div className="text-xs font-bold text-muted-2 uppercase">Йўлда</div>
            <div className="font-heading font-extrabold text-xl text-danger mt-1">−{formatSom(pointTotal.YOLDA)}</div>
          </Card>
        )}
        {pointTotal.ISHXONA > 0 && (
          <Card className="p-4">
            <div className="text-xs font-bold text-muted-2 uppercase">Ишхона</div>
            <div className="font-heading font-extrabold text-xl text-danger mt-1">
              −{formatSom(pointTotal.ISHXONA)}
            </div>
          </Card>
        )}
        {pointTotal.VEHICLE > 0 && (
          <Card className="p-4">
            <div className="text-xs font-bold text-muted-2 uppercase">Машина</div>
            <div className="font-heading font-extrabold text-xl text-danger mt-1">
              −{formatSom(pointTotal.VEHICLE)}
            </div>
          </Card>
        )}
        {pointTotal.ADVANCE > 0 && (
          <Card className="p-4">
            <div className="text-xs font-bold text-muted-2 uppercase">Аванс</div>
            <div className="font-heading font-extrabold text-xl text-danger mt-1">
              −{formatSom(pointTotal.ADVANCE)}
            </div>
          </Card>
        )}
        <Card className="p-4">
          <div className="text-xs font-bold text-muted-2 uppercase">Жами</div>
          <div className="font-heading font-extrabold text-xl text-heading mt-1">−{formatSom(grandTotal)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden lg:grid grid-cols-[1.7fr_0.8fr_1fr_0.9fr_1fr] px-5 py-2 bg-page text-[11px] font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Ходим</div>
          <div>Пункт</div>
          <div>Тоифа</div>
          <div>Сумма</div>
          <div>Амаллар</div>
        </div>
        {pageRows.map((r) => (
          <div
            key={r.id}
            className="hidden lg:grid grid-cols-[1.7fr_0.8fr_1fr_0.9fr_1fr] gap-x-2 px-5 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="min-w-0">
              <div className="font-extrabold text-heading truncate">{r.personName}</div>
              <div className="text-xs text-muted-2 font-semibold mt-0.5 truncate">
                {r.time.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} · {r.note ?? "—"}
              </div>
            </div>
            <div>
              <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                {POINT_LABELS[r.point] ?? r.point}
              </span>
            </div>
            <div>
              <span className="bg-page border border-border text-muted text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                {r.category}
              </span>
            </div>
            <div className="font-extrabold text-danger">−{formatSom(r.amount)}</div>
            <div className="flex items-center gap-1.5">
              {r.editable ? (
                <>
                  <Link
                    href={`/accountant/expenses/${r.id}/edit`}
                    title="Таҳрирлаш"
                    className="text-muted-2 hover:text-primary text-base leading-none px-1"
                  >
                    ✎
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteExpenseAction}
                    id={r.id}
                    confirmText="Бу расходни ўчиришни тасдиқлайсизми?"
                    className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                  />
                </>
              ) : (
                <span className="text-[11px] text-muted-2 font-semibold px-1">{r.point === "VEHICLE" ? "Механикда" : r.point === "ADVANCE" ? "Аванслар саҳифасида" : "Диспетчер журналида"}</span>
              )}
            </div>
          </div>
        ))}

        {/* Mobile cards */}
        <div className="lg:hidden">
          {pageRows.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 px-5 py-3 border-t border-row-divider first:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-extrabold text-heading truncate">{r.personName}</div>
                  <div className="text-xs text-muted-2 font-semibold mt-0.5">
                    {r.time.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })} · {r.note ?? "—"}
                  </div>
                </div>
                <div className="font-extrabold text-danger whitespace-nowrap">−{formatSom(r.amount)}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="bg-primary-tint text-primary text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {POINT_LABELS[r.point] ?? r.point}
                  </span>
                  <span className="bg-page border border-border text-muted text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {r.category}
                  </span>
                </div>
                {r.editable ? (
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/accountant/expenses/${r.id}/edit`}
                      title="Таҳрирлаш"
                      className="text-muted-2 hover:text-primary text-base leading-none px-1"
                    >
                      ✎
                    </Link>
                    <ConfirmDeleteButton
                      action={deleteExpenseAction}
                      id={r.id}
                      confirmText="Бу расходни ўчиришни тасдиқлайсизми?"
                      className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
                    />
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-2 font-semibold px-1">{r.point === "VEHICLE" ? "Механикда" : r.point === "ADVANCE" ? "Аванслар саҳифасида" : "Диспетчер журналида"}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {pageRows.length === 0 && <p className="text-[13px] text-muted-2 px-5 py-4">Бу даврда расход йўқ</p>}
        <Pagination page={page} totalPages={pages} basePath="/accountant/expenses" params={pageParams} />
      </Card>
    </div>
  );
}
