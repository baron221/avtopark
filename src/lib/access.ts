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
  { key: "FLEET_DASHBOARD", label: "Фойда панели (бутун парк)", href: "/owner", navLabel: "Фойда панели", navIcon: "◉" },
  { key: "USER_MANAGEMENT", label: "Фойдаланувчилар / роллар", href: "/admin/users", navLabel: "Ходимлар", navIcon: "◈" },
  {
    key: "PAYROLL",
    label: "Ведомост · аванс · жарима · обед",
    href: "/accountant/payroll",
    navLabel: "Ведомост",
    navIcon: "▤",
  },
  {
    key: "COLLECT_PAYMENT",
    label: "Пул қабул қилиш (пункт)",
    href: "/dispatcher/point",
    navLabel: "Пул қабул қилиш",
    navIcon: "◉",
  },
  {
    key: "INCOME_EXPENSE_LOG",
    label: "Кирим-чиқим журнали",
    href: "/dispatcher/journal",
    navLabel: "Кирим-чиқим",
    navIcon: "▤",
  },
  { key: "VEHICLES", label: "Машиналар (қўшиш, таъмир)", href: "/mechanic/vehicles", navLabel: "Машиналар", navIcon: "▤" },
  { key: "FUEL", label: "Ёқилғи · заправка тўловлари", href: "/mechanic/fuel", navLabel: "Ёқилғи", navIcon: "◉" },
  { key: "SHIFTS", label: "Сменалар", href: "/mechanic/shifts", navLabel: "Сменалар", navIcon: "▥" },
  { key: "TRIP_ENTRY", label: "Рейс / заказ киритиш", href: "/dispatcher/journal", navLabel: "Рейс киритиш", navIcon: "▥" },
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

// A few roles already show a module's exact same data on one of their own
// native screens (ACCOUNTANT's "Hisobot" and ADMIN's "Panel" both embed the
// identical fleet dashboard as /owner, just wrapped in their own nav style).
// For those roles, point the granted module at that native screen instead of
// the standalone /owner page — its own distinct header/nav would otherwise
// look like a jarringly different app, and getGuestNavLinks's href-dedup then
// drops the now-redundant duplicate automatically.
const ROLE_HREF_OVERRIDE: Partial<Record<Role, Partial<Record<ModuleKey, string>>>> = {
  ACCOUNTANT: { FLEET_DASHBOARD: "/accountant/report" },
  ADMIN: { FLEET_DASHBOARD: "/admin/panel" },
};

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
    const href = ROLE_HREF_OVERRIDE[role]?.[m.key] ?? m.href;
    if (seenHref.has(href)) continue;
    seenHref.add(href);
    links.push({ href, label: m.navLabel, icon: m.navIcon });
  }
  return links;
}

// Mirrors each grantable role's own hardcoded nav (see <Role>Nav.tsx). Kept
// here too so a granted guest keeps seeing their own section's links while
// browsing a module granted to them elsewhere — without this, every layout's
// "guest" branch replaces `base` with `[]`, so a role's own navbar options
// would disappear the moment they followed a cross-granted link out of it.
const HOME_NAV: Partial<Record<Role, { href: string; label: string; icon: string }[]>> = {
  ADMIN: [
    { href: "/admin/panel", label: "Панел", icon: "◉" },
    { href: "/admin/users", label: "Ходимлар", icon: "◈" },
    { href: "/admin/shifts", label: "Сменалар", icon: "▤" },
    { href: "/admin/access", label: "Ҳуқуқлар", icon: "▨" },
    { href: "/admin/deletions", label: "Ўчирилганлар", icon: "▩" },
  ],
  OWNER: [
    { href: "/owner", label: "Фойда панели", icon: "◉" },
    { href: "/owner/report", label: "Ҳисобот", icon: "▨" },
    { href: "/owner/drivers", label: "Ҳайдовчилар", icon: "◈" },
    { href: "/owner/gps", label: "GPS", icon: "▤" },
  ],
  ACCOUNTANT: [
    { href: "/accountant/report", label: "Ҳисобот", icon: "▨" },
    { href: "/accountant/payroll", label: "Ведомост", icon: "▤" },
    { href: "/accountant/advances", label: "Аванслар", icon: "◈" },
    { href: "/accountant/fines", label: "Жарималар", icon: "▥" },
    { href: "/accountant/expenses", label: "Расходлар", icon: "◉" },
  ],
  MECHANIC: [
    { href: "/mechanic/fuel", label: "Ёқилғи", icon: "◉" },
    { href: "/mechanic/vehicles", label: "Машиналар", icon: "▤" },
    { href: "/mechanic/fuel/payments", label: "Тўловлар", icon: "▥" },
    { href: "/mechanic/shifts", label: "Сменалар", icon: "▦" },
  ],
};

/**
 * For a role acting as a "guest" outside its own section: its own native nav
 * plus every module granted to it elsewhere, deduped by href — so the
 * navbar's option count stays the same no matter which granted screen it's
 * currently on, instead of shrinking to just that screen's local extras.
 */
export async function getGuestNavLinks(
  role: Role,
  excludeKeys: ModuleKey[] = []
): Promise<{ href: string; label: string; icon: string }[]> {
  const home = HOME_NAV[role] ?? [];
  const granted = await getGrantedNavLinks(role, excludeKeys);
  const seenHref = new Set(home.map((l) => l.href));
  const links = [...home];
  for (const l of granted) {
    if (seenHref.has(l.href)) continue;
    seenHref.add(l.href);
    links.push(l);
  }
  return links;
}
