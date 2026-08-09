"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { formatSom } from "@/lib/format";
import { setMaoshAction, setBonusAction, addAdvanceAction, addFineAction } from "./actions";
import type { Point, Role } from "@prisma/client";

const GRID_COLS = "grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.85fr_0.8fr_0.75fr_0.9fr_1fr]";

export function PayrollRow({
  user,
  baseSalary,
  bonus,
  fines,
  advance,
  netPay,
  netPayKnown,
  dayCount,
  monthStr,
  isCurrentMonth,
  detailHref,
  today,
}: {
  user: { id: string; fullName: string; role: Role; point: Point | null };
  baseSalary: number;
  bonus: number;
  fines: number;
  advance: number;
  netPay: number;
  netPayKnown: boolean;
  dayCount?: number;
  monthStr: string;
  isCurrentMonth: boolean;
  detailHref: string;
  today: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  function handleRowClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("form, button, a, input")) return;
    router.push(detailHref);
  }

  return (
    <div className="border-t border-row-divider">
      <div
        className={`grid ${GRID_COLS} gap-y-1.5 gap-x-2 px-6 py-3.5 items-center text-sm cursor-pointer hover:bg-page transition-colors`}
        onClick={handleRowClick}
      >
        <div className="font-extrabold text-heading col-span-2 lg:col-span-1">{user.fullName}</div>
        <div>
          <RoleBadge role={user.role} point={user.point} />
        </div>
        <div className="font-bold text-heading">
          {formatSom(baseSalary)}
          {user.role === "DRIVER" && (
            <span className="block text-[10px] text-muted-2 font-semibold">{dayCount ?? 0} кун ишлаган</span>
          )}
        </div>
        <div className="font-extrabold text-primary">{advance > 0 ? `−${formatSom(advance)}` : "0"}</div>
        <div className="font-extrabold text-danger">{fines > 0 ? `−${formatSom(fines)}` : "0"}</div>
        <div className="font-bold text-success">+{formatSom(bonus)}</div>
        <div className="font-heading font-extrabold text-heading flex items-center gap-2">
          {netPayKnown ? formatSom(netPay) : "—"}
          {isCurrentMonth && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="text-primary text-xs font-extrabold hover:underline"
            >
              Таҳрирлаш
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="px-6 py-4 bg-page grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-row-divider"
          onClick={(e) => e.stopPropagation()}
        >
          {user.role !== "DRIVER" && (
            <form action={setMaoshAction} className="flex flex-col gap-1.5">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="month" value={monthStr} />
              <label className="text-[11px] font-bold text-muted-2 uppercase">Маош</label>
              <div className="flex gap-1.5">
                <MoneyInput
                  name="baseSalary"
                  defaultValue={baseSalary}
                  className="flex-1 min-w-0 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
                />
                <button type="submit" className="bg-primary text-white rounded-md px-2.5 text-xs font-extrabold">
                  ✓
                </button>
              </div>
            </form>
          )}

          <form action={setBonusAction} className="flex flex-col gap-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="month" value={monthStr} />
            <label className="text-[11px] font-bold text-muted-2 uppercase">Бонус</label>
            <div className="flex gap-1.5">
              <MoneyInput
                name="bonus"
                defaultValue={bonus}
                className="flex-1 min-w-0 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-white rounded-md px-2.5 text-xs font-extrabold">
                ✓
              </button>
            </div>
          </form>

          <form action={addAdvanceAction} className="flex flex-col gap-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="month" value={monthStr} />
            <label className="text-[11px] font-bold text-muted-2 uppercase">Янги аванс</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                name="date"
                defaultValue={today}
                max={today}
                required
                className="bg-card border border-border rounded-md px-2 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
              />
              <MoneyInput
                name="amount"
                placeholder="Сумма"
                className="flex-1 min-w-0 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-white rounded-md px-2.5 text-xs font-extrabold">
                +
              </button>
            </div>
          </form>

          <form action={addFineAction} className="flex flex-col gap-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="month" value={monthStr} />
            <label className="text-[11px] font-bold text-muted-2 uppercase">Янги жарима</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                name="date"
                defaultValue={today}
                max={today}
                required
                className="bg-card border border-border rounded-md px-2 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
              />
              <MoneyInput
                name="amount"
                placeholder="Сумма"
                className="flex-1 min-w-0 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                name="reason"
                placeholder="Сабаб"
                required
                className="flex-1 min-w-0 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-bold text-heading outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-white rounded-md px-2.5 text-xs font-extrabold">
                +
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
