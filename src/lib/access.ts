import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type ModuleKey =
  | "FLEET_DASHBOARD"
  | "USER_MANAGEMENT"
  | "PAYROLL"
  | "COLLECT_PAYMENT"
  | "INCOME_EXPENSE_LOG"
  | "VEHICLES"
  | "FUEL"
  | "SHIFTS"
  | "TRIP_ENTRY";

// Only these four "back-office" roles can be cross-granted access to each
// other's modules. Dispatcher/Driver are excluded on purpose: their
// point/own-record scoping is load-bearing business logic (Farg'ona
// dispatcher must never see Quva's data), not a togglable view — so their
// access stays exactly as hardcoded in each page, unaffected by this table.
export const GRANTABLE_ROLES: Role[] = ["ADMIN", "OWNER", "ACCOUNTANT", "MECHANIC"];

export type ModuleConfig = {
  key: ModuleKey;
  label: string;
  href: string;
  navLabel: string;
  navIcon: string;
};

export const MODULES: ModuleConfig[] = [
  { key: "FLEET_DASHBOARD", label: "Foyda paneli (butun park)", href: "/owner", navLabel: "Foyda paneli", navIcon: "◉" },
  { key: "USER_MANAGEMENT", label: "Foydalanuvchilar / rollar", href: "/admin/users", navLabel: "Xodimlar", navIcon: "◈" },
  {
    key: "PAYROLL",
    label: "Vedomost · avans · jarima · obed",
    href: "/accountant/payroll",
    navLabel: "Vedomost",
    navIcon: "▤",
  },
  {
    key: "COLLECT_PAYMENT",
    label: "Pul qabul qilish (punkt)",
    href: "/dispatcher/point",
    navLabel: "Pul qabul qilish",
    navIcon: "◉",
  },
  {
    key: "INCOME_EXPENSE_LOG",
    label: "Kirim-chiqim jurnali",
    href: "/dispatcher/journal",
    navLabel: "Kirim-chiqim",
    navIcon: "▤",
  },
  { key: "VEHICLES", label: "Mashinalar (qo'shish, ta'mir)", href: "/mechanic/vehicles", navLabel: "Mashinalar", navIcon: "▤" },
  { key: "FUEL", label: "Yoqilg'i · zapravka to'lovlari", href: "/mechanic/fuel", navLabel: "Yoqilg'i", navIcon: "◉" },
  { key: "SHIFTS", label: "Smenalar", href: "/mechanic/shifts", navLabel: "Smenalar", navIcon: "▥" },
  { key: "TRIP_ENTRY", label: "Reys / zakaz kiritish", href: "/dispatcher/journal", navLabel: "Reys kiritish", navIcon: "▥" },
];

export function moduleConfig(key: ModuleKey): ModuleConfig {
  const config = MODULES.find((m) => m.key === key);
  if (!config) throw new Error(`Unknown module: ${key}`);
  return config;
}

// The state that was already real before this table existed. Applied once
// via a migration/seed script (see prisma seed history) — NOT re-applied at
// runtime, since re-running it on every cold start would silently resurrect
// grants an Admin had deliberately revoked.
export const INITIAL_GRANTS: Record<ModuleKey, Role[]> = {
  FLEET_DASHBOARD: ["ADMIN", "OWNER", "ACCOUNTANT"],
  USER_MANAGEMENT: ["ADMIN"],
  PAYROLL: ["ACCOUNTANT"],
  COLLECT_PAYMENT: [],
  INCOME_EXPENSE_LOG: [],
  VEHICLES: ["MECHANIC"],
  FUEL: ["MECHANIC"],
  SHIFTS: ["ADMIN", "MECHANIC"],
  TRIP_ENTRY: [],
};

/** Full read+write access to a module for one of the four grantable roles. */
export async function hasModuleAccess(role: Role, key: ModuleKey): Promise<boolean> {
  if (!GRANTABLE_ROLES.includes(role)) return false;
  const row = await prisma.rolePermission.findUnique({ where: { role_module: { role, module: key } } });
  return !!row;
}

/** True if the role has access to any module whose home page lives under a given path prefix — for layout-level gating. */
export async function hasAnyModuleAccess(role: Role, keys: ModuleKey[]): Promise<boolean> {
  if (!GRANTABLE_ROLES.includes(role)) return false;
  const rows = await prisma.rolePermission.findMany({ where: { role, module: { in: keys } } });
  return rows.length > 0;
}

export async function getGrantedModuleKeys(role: Role): Promise<ModuleKey[]> {
  if (!GRANTABLE_ROLES.includes(role)) return [];
  const rows = await prisma.rolePermission.findMany({ where: { role } });
  return rows.map((r) => r.module as ModuleKey);
}

/** Extra nav links for modules a role has beyond its own native screens. */
export async function getGrantedNavLinks(
  role: Role,
  excludeKeys: ModuleKey[] = []
): Promise<{ href: string; label: string; icon: string }[]> {
  const granted = new Set(await getGrantedModuleKeys(role));
  const seenHref = new Set<string>();
  const links: { href: string; label: string; icon: string }[] = [];
  for (const m of MODULES) {
    if (excludeKeys.includes(m.key)) continue;
    if (!granted.has(m.key)) continue;
    if (seenHref.has(m.href)) continue;
    seenHref.add(m.href);
    links.push({ href: m.href, label: m.navLabel, icon: m.navIcon });
  }
  return links;
}
