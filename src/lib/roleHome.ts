import type { Role } from "@prisma/client";

export const ROLE_HOME: Record<Role, string> = {
  OWNER: "/owner",
  ADMIN: "/admin/panel",
  ACCOUNTANT: "/accountant/report",
  DISPATCHER: "/dispatcher/point",
  MECHANIC: "/mechanic/fuel",
  DRIVER: "/driver",
};
