import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ACCESS_MATRIX, ACCESS_ROLE_COLUMNS, type AccessLevel } from "@/lib/permissions";
import { GRANTABLE_MODULES } from "@/lib/access";
import { ROLE_LABELS } from "@/components/ui/RoleBadge";
import { prisma } from "@/lib/prisma";
import { toggleModuleGrantAction } from "./actions";

const LEVEL_STYLE: Record<AccessLevel, { bg: string; color: string; label: string }> = {
  YES: { bg: "#E4F5EC", color: "#1B9E6B", label: "✓" },
  OWN: { bg: "#FFF3E0", color: "#B26A00", label: "faqat o'ziniki" },
  NO: { bg: "#F6F7FB", color: "#C9CBE3", label: "—" },
};

export default async function AccessMatrixPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/coming-soon");

  const grants = await prisma.rolePermission.findMany();
  const grantedSet = new Set(grants.map((g) => `${g.role}:${g.module}`));

  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div>
        <div className="font-heading font-bold text-xl text-heading">Rollar va kirish huquqlari</div>
        <div className="text-[13px] text-muted-2 font-semibold mt-1">
          «Faqat o&apos;ziniki» — o&apos;z yozuvlari / o&apos;z punkti / o&apos;z smenasi. Farg&apos;ona dispetcheri
          Quva punktini ko&apos;rmaydi va aksincha.
        </div>
      </div>

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <div className="grid grid-cols-[1.8fr_0.7fr_0.7fr_0.9fr_1.1fr_0.9fr_1.1fr] px-6 py-3 bg-page text-xs font-extrabold text-muted-2 uppercase tracking-wide">
          <div>Bo&apos;lim</div>
          {ACCESS_ROLE_COLUMNS.map((c) => (
            <div key={c.key}>{c.label}</div>
          ))}
        </div>
        {ACCESS_MATRIX.map((row) => (
          <div
            key={row.module}
            className="grid grid-cols-[1.8fr_0.7fr_0.7fr_0.9fr_1.1fr_0.9fr_1.1fr] px-6 py-3 border-t border-row-divider items-center text-sm"
          >
            <div className="font-bold text-heading">{row.module}</div>
            {ACCESS_ROLE_COLUMNS.map((c) => {
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
              {ACCESS_ROLE_COLUMNS.map((c) => {
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
              })}
            </div>
          </Card>
        ))}
      </div>

      <div>
        <div className="font-heading font-bold text-lg text-heading">Qo&apos;shimcha ko&apos;rish huquqlari</div>
        <div className="text-[13px] text-muted-2 font-semibold mt-1">
          Yuqoridagi jadvaldan tashqari, rolga qo&apos;shimcha bo&apos;limlarni <strong>faqat ko&apos;rish</strong> uchun
          ochib berishingiz mumkin (yozish/o&apos;chirish huquqisiz).
        </div>
      </div>

      <Card className="overflow-hidden">
        {GRANTABLE_MODULES.map((mod) => (
          <div key={mod.key} className="px-6 py-4 border-t border-row-divider first:border-t-0">
            <div className="font-extrabold text-heading text-sm mb-2.5">{mod.label}</div>
            <div className="flex flex-wrap gap-2">
              {mod.grantableRoles.map((role) => {
                const granted = grantedSet.has(`${role}:${mod.key}`);
                return (
                  <form key={role} action={toggleModuleGrantAction}>
                    <input type="hidden" name="role" value={role} />
                    <input type="hidden" name="module" value={mod.key} />
                    <input type="hidden" name="nextGranted" value={granted ? "0" : "1"} />
                    <button
                      type="submit"
                      className={`text-xs font-extrabold px-3 py-1.5 rounded-lg ${
                        granted ? "bg-success-tint text-success" : "bg-page text-muted-2 border border-border"
                      }`}
                    >
                      {ROLE_LABELS[role]} {granted ? "✓ berilgan" : "— berilmagan"}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
