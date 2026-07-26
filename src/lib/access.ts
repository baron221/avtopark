import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type GrantableModule = "VEHICLES_VIEW" | "SHIFTS_VIEW";

export type GrantableModuleConfig = {
  key: GrantableModule;
  label: string;
  href: string;
  navLabel: string;
  navIcon: string;
  /** Roles that already have this by fixed design (not admin-grantable, always on). */
  alwaysGranted: Role[];
  /** Roles the admin is allowed to toggle this module on/off for. */
  grantableRoles: Role[];
};

// Extra, admin-grantable VIEW-only access — additive on top of each role's
// fixed screens. Never grants write/delete actions, so it can't be used to
// bypass the write-permission boundaries baked into each action file.
export const GRANTABLE_MODULES: GrantableModuleConfig[] = [
  {
    key: "VEHICLES_VIEW",
    label: "Mashinalar ro'yxati (faqat ko'rish)",
    href: "/fleet/vehicles",
    navLabel: "Mashinalar",
    navIcon: "▤",
    alwaysGranted: ["ADMIN", "MECHANIC"],
    grantableRoles: ["OWNER", "ACCOUNTANT", "DISPATCHER"],
  },
  {
    key: "SHIFTS_VIEW",
    label: "Smenalar (faqat ko'rish)",
    href: "/fleet/shifts",
    navLabel: "Smenalar",
    navIcon: "▥",
    alwaysGranted: ["ADMIN", "OWNER", "MECHANIC"],
    grantableRoles: ["ACCOUNTANT", "DISPATCHER"],
  },
];

export function moduleConfig(module: GrantableModule): GrantableModuleConfig {
  const config = GRANTABLE_MODULES.find((m) => m.key === module);
  if (!config) throw new Error(`Unknown module: ${module}`);
  return config;
}

export async function hasModuleAccess(role: Role, module: GrantableModule): Promise<boolean> {
  const config = moduleConfig(module);
  if (config.alwaysGranted.includes(role)) return true;
  if (!config.grantableRoles.includes(role)) return false;
  const row = await prisma.rolePermission.findUnique({ where: { role_module: { role, module } } });
  return !!row;
}

/** Extra nav links a role should see, based on active grants. For use in each role's nav/layout. */
export async function getGrantedNavLinks(role: Role): Promise<{ href: string; label: string; icon: string }[]> {
  const grants = await prisma.rolePermission.findMany({ where: { role } });
  const grantedKeys = new Set(grants.map((g) => g.module));
  return GRANTABLE_MODULES.filter((m) => m.grantableRoles.includes(role) && grantedKeys.has(m.key)).map((m) => ({
    href: m.href,
    label: m.navLabel,
    icon: m.navIcon,
  }));
}
