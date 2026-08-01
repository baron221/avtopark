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
  { module: "Фойда панели (бутун парк)", moduleKey: "FLEET_DASHBOARD", admin: "YES", owner: "YES", acc: "YES", disp: "NO", mech: "NO", drv: "NO" },
  { module: "Фойдаланувчилар / роллар", moduleKey: "USER_MANAGEMENT", admin: "YES", owner: "NO", acc: "NO", disp: "NO", mech: "NO", drv: "NO" },
  { module: "Ведомост · аванс · жарима · обед", moduleKey: "PAYROLL", admin: "YES", owner: "YES", acc: "YES", disp: "OWN", mech: "OWN", drv: "OWN" },
  { module: "Пул қабул қилиш (пункт)", moduleKey: "COLLECT_PAYMENT", admin: "YES", owner: "NO", acc: "NO", disp: "OWN", mech: "NO", drv: "NO" },
  { module: "Кирим-чиқим журнали", moduleKey: "INCOME_EXPENSE_LOG", admin: "YES", owner: "YES", acc: "YES", disp: "OWN", mech: "NO", drv: "OWN" },
  { module: "Машиналар (қўшиш, таъмир)", moduleKey: "VEHICLES", admin: "YES", owner: "NO", acc: "NO", disp: "NO", mech: "YES", drv: "NO" },
  { module: "Ёқилғи · заправка тўловлари", moduleKey: "FUEL", admin: "YES", owner: "YES", acc: "YES", disp: "NO", mech: "YES", drv: "OWN" },
  { module: "Сменалар", moduleKey: "SHIFTS", admin: "YES", owner: "YES", acc: "NO", disp: "OWN", mech: "NO", drv: "OWN" },
  { module: "Рейс / заказ киритиш", moduleKey: "TRIP_ENTRY", admin: "YES", owner: "NO", acc: "NO", disp: "OWN", mech: "NO", drv: "OWN" },
];

export const ACCESS_ROLE_COLUMNS = [
  { key: "admin", label: "Админ" },
  { key: "owner", label: "Эгаси" },
  { key: "acc", label: "Бухгалтер" },
  { key: "disp", label: "Диспетчер" },
  { key: "mech", label: "Механик" },
  { key: "drv", label: "Ҳайдовчи" },
] as const;
