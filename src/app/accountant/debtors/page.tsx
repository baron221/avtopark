import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { formatSom } from "@/lib/format";
import { SettleDebtButton } from "./SettleDebtButton";

/** Accountant-only (see AccountantNav's own scoping: a granted non-accountant
 * guest never gets this nav link at all) — settling a debt is specifically
 * the accountant's job, not the dispatcher who entered the order. */
export default async function DebtorsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ACCOUNTANT") redirect("/coming-soon");

  // Prisma can't compare two columns of the same row in a `where` filter, so
  // ORDER rows are fetched unsettled-only from the DB and the
  // collectedAmount < revenue check (what actually makes a row "owed") runs
  // in JS — cheap here since only ORDER volume (a small slice of all trips)
  // is ever fetched, unlike a query over the whole trips table.
  const orders = await prisma.trip.findMany({
    where: { kind: "ORDER", debtSettledAt: null },
    include: { vehicle: true, enteredByUser: true },
    orderBy: { tripDate: "desc" },
  });
  const debtors = orders.filter((t) => t.collectedAmount < t.revenue);
  const totalOwed = debtors.reduce((s, t) => s + Number(t.revenue - t.collectedAmount), 0);

  return (
    <div className="max-w-[900px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Қарздорлар</div>
        <div className="text-[13px] text-muted-2 font-semibold">Жами қарз: {formatSom(totalOwed)}</div>
      </div>

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden lg:grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_0.8fr] px-6 py-2 bg-page text-[11px] font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Сана</div>
          <div>Машина / изоҳ</div>
          <div>Умумий сумма</div>
          <div>Олинган</div>
          <div>Қарз</div>
          <div>Амал</div>
        </div>
        {debtors.map((t) => {
          const owed = Number(t.revenue - t.collectedAmount);
          return (
            <div
              key={t.id}
              className="hidden lg:grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_0.8fr] gap-x-2 px-6 py-3 border-t border-row-divider items-center text-sm"
            >
              <div className="text-xs font-semibold text-muted-2">
                {t.tripDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-heading truncate">{t.vehicle.plate}</div>
                <div className="text-xs text-muted-2 font-semibold mt-0.5 truncate">
                  {t.note ? `${t.note} · ` : ""}
                  {t.enteredByUser.fullName}
                </div>
              </div>
              <div className="font-bold text-heading">{formatSom(Number(t.revenue))}</div>
              <div className="font-bold text-success">{formatSom(Number(t.collectedAmount))}</div>
              <div className="font-extrabold text-danger">{formatSom(owed)}</div>
              <div>
                <SettleDebtButton id={t.id} amount={owed} />
              </div>
            </div>
          );
        })}

        {/* Mobile cards */}
        <div className="lg:hidden">
          {debtors.map((t) => {
            const owed = Number(t.revenue - t.collectedAmount);
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3 border-t border-row-divider first:border-t-0 text-sm">
                <div className="min-w-0">
                  <div className="font-extrabold text-heading truncate">{t.vehicle.plate}</div>
                  <div className="text-xs text-muted-2 font-semibold mt-0.5 truncate">
                    {t.note ? `${t.note} · ` : ""}
                    {t.enteredByUser.fullName}
                  </div>
                  <div className="text-xs text-muted-2 font-semibold mt-0.5">
                    {t.tripDate.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })} · жами{" "}
                    {formatSom(Number(t.revenue))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="font-extrabold text-danger whitespace-nowrap">{formatSom(owed)}</div>
                  <SettleDebtButton id={t.id} amount={owed} />
                </div>
              </div>
            );
          })}
        </div>

        {debtors.length === 0 && <p className="text-[13px] text-muted-2 px-6 py-4">Ҳозирча қарздорлик йўқ</p>}
      </Card>
    </div>
  );
}
