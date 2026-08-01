import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ACCESS_MATRIX, type AccessLevel } from "@/lib/permissions";
import { GRANTABLE_ROLES } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { toggleModuleGrantAction } from "./actions";
import type { Role } from "@prisma/client";

const LEVEL_STYLE: Record<AccessLevel, { bg: string; color: string; label: string }> = {
  YES: { bg: "#E4F5EC", color: "#1B9E6B", label: "✓" },
  OWN: { bg: "#FFF3E0", color: "#B26A00", label: "фақат ўзиники" },
  NO: { bg: "#F6F7FB", color: "#C9CBE3", label: "—" },
};

// Fixed visual column order, matching the original design matrix. The first
// four are live checkboxes (RolePermission-backed); Dispetcher/Haydovchi
// stay static — their point/own-record scoping is hardcoded, not a toggle.
const COLUMNS: { key: "admin" | "owner" | "acc" | "disp" | "mech" | "drv"; label: string; role: Role | null }[] = [
  { key: "admin", label: "Админ", role: "ADMIN" },
  { key: "owner", label: "Эгаси", role: "OWNER" },
  { key: "acc", label: "Бухгалтер", role: "ACCOUNTANT" },
  { key: "disp", label: "Диспетчер", role: null },
  { key: "mech", label: "Механик", role: "MECHANIC" },
  { key: "drv", label: "Ҳайдовчи", role: null },
];

export default async function AccessMatrixPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/coming-soon");

  const grants = await prisma.rolePermission.findMany({ where: { role: { in: GRANTABLE_ROLES } } });
  const grantedSet = new Set(grants.map((g) => `${g.role}:${g.module}`));

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Роллар ва кириш ҳуқуқлари</div>
        <div className="text-[13px] text-muted-2 font-semibold mt-1">
          Админ, Эгаси, Бухгалтер, Механик устунларидаги катакчаларни босиб, бир-бирининг бўлимларига тўлиқ
          ҳуқуқ бера оласиз. Диспетчер ва Ҳайдовчи — «фақат ўзиники» (ўз пункти / ўз ёзувлари)
          қоидаси кодда қаттиқ белгиланган, шунинг учун бу ердан ўзгартирилмайди.
        </div>
      </div>

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="grid grid-cols-[1.8fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Бўлим</div>
          {COLUMNS.map((c) => (
            <div key={c.key}>{c.label}</div>
          ))}
        </div>
        {ACCESS_MATRIX.map((row) => (
          <div
            key={row.module}
            className="grid grid-cols-[1.8fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr] px-6 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="font-bold text-heading">{row.module}</div>
            {COLUMNS.map((c) => {
              if (!c.role) {
                const level = row[c.key];
                const style = LEVEL_STYLE[level];
                return (
                  <div key={c.key}>
                    <span
                      className="text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </div>
                );
              }
              const role = c.role;
              const granted = grantedSet.has(`${role}:${row.moduleKey}`);
              const locked = role === "ADMIN" && row.moduleKey === "USER_MANAGEMENT";
              return (
                <div key={c.key}>
                  {locked ? (
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap bg-success-tint text-success">
                      ✓ доимий
                    </span>
                  ) : (
                    <form action={toggleModuleGrantAction}>
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="module" value={row.moduleKey} />
                      <input type="hidden" name="nextGranted" value={granted ? "0" : "1"} />
                      <button
                        type="submit"
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          granted ? "bg-success-tint text-success" : "bg-page text-muted-2 border border-border"
                        }`}
                      >
                        {granted ? "✓" : "—"}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {ACCESS_MATRIX.map((row) => (
          <Card key={row.module} className="p-4 flex flex-col gap-2.5">
            <div className="font-bold text-heading text-sm">{row.module}</div>
            <div className="grid grid-cols-2 gap-2">
              {COLUMNS.map((c) => {
                if (!c.role) {
                  const level = row[c.key];
                  const style = LEVEL_STYLE[level];
                  return (
                    <div key={c.key} className="flex justify-between items-center text-xs">
                      <span className="text-muted-2 font-bold">{c.label}</span>
                      <span
                        className="font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {style.label}
                      </span>
                    </div>
                  );
                }
                const role = c.role;
                const granted = grantedSet.has(`${role}:${row.moduleKey}`);
                const locked = role === "ADMIN" && row.moduleKey === "USER_MANAGEMENT";
                return (
                  <div key={c.key} className="flex justify-between items-center text-xs">
                    <span className="text-muted-2 font-bold">{c.label}</span>
                    {locked ? (
                      <span className="font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap bg-success-tint text-success">
                        ✓ доимий
                      </span>
                    ) : (
                      <form action={toggleModuleGrantAction}>
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="module" value={row.moduleKey} />
                        <input type="hidden" name="nextGranted" value={granted ? "0" : "1"} />
                        <button
                          type="submit"
                          className={`font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            granted ? "bg-success-tint text-success" : "bg-page text-muted-2 border border-border"
                          }`}
                        >
                          {granted ? "✓" : "—"}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
