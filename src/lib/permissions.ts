import type { ModuleKey } from "@/lib/access";

export type AccessLevel = "YES" | "OWN" | "NO";

export type AccessRow = {
  module: string;
  moduleKey: ModuleKey;
  admin: AccessLevel;
  owner: AccessLevel;
  acc: AccessLevel;
  disp: AccessLevel;
  mech: AccessLevel;
  drv: AccessLevel;
};

// Source of truth: design_handoff_avtopark/Avtopark Foyda.dc.html, screen "3a Kirish huquqlari".
// admin/owner/acc/mech columns are now live checkboxes backed by RolePermission
// (see /admin/access); disp/mech "OWN" scoping stays hardcoded in each page.
export const ACCESS_MATRIX: AccessRow[] = [
  { module: "Foyda paneli (butun park)", moduleKey: "FLEET_DASHBOARD", admin: "YES", owner: "YES", acc: "YES", disp: "NO", mech: "NO", drv: "NO" },
  { module: "Foydalanuvchilar / rollar", moduleKey: "USER_MANAGEMENT", admin: "YES", owner: "NO", acc: "NO", disp: "NO", mech: "NO", drv: "NO" },
  { module: "Vedomost · avans · jarima · obed", moduleKey: "PAYROLL", admin: "YES", owner: "YES", acc: "YES", disp: "OWN", mech: "OWN", drv: "OWN" },
  { module: "Pul qabul qilish (punkt)", moduleKey: "COLLECT_PAYMENT", admin: "YES", owner: "NO", acc: "NO", disp: "OWN", mech: "NO", drv: "NO" },
  { module: "Kirim-chiqim jurnali", moduleKey: "INCOME_EXPENSE_LOG", admin: "YES", owner: "YES", acc: "YES", disp: "OWN", mech: "NO", drv: "OWN" },
  { module: "Mashinalar (qo'shish, ta'mir)", moduleKey: "VEHICLES", admin: "YES", owner: "NO", acc: "NO", disp: "NO", mech: "YES", drv: "NO" },
  { module: "Yoqilg'i · zapravka to'lovlari", moduleKey: "FUEL", admin: "YES", owner: "YES", acc: "YES", disp: "NO", mech: "YES", drv: "OWN" },
  { module: "Smenalar", moduleKey: "SHIFTS", admin: "YES", owner: "YES", acc: "NO", disp: "OWN", mech: "NO", drv: "OWN" },
  { module: "Reys / zakaz kiritish", moduleKey: "TRIP_ENTRY", admin: "YES", owner: "NO", acc: "NO", disp: "OWN", mech: "NO", drv: "OWN" },
];

export const ACCESS_ROLE_COLUMNS = [
  { key: "admin", label: "Admin" },
  { key: "owner", label: "Egasi" },
  { key: "acc", label: "Buxgalter" },
  { key: "disp", label: "Dispetcher" },
  { key: "mech", label: "Mexanik" },
  { key: "drv", label: "Haydovchi" },
] as const;
