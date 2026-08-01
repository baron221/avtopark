"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GRANTABLE_ROLES, type ModuleKey } from "@/lib/access";
import type { Role } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Рухсат йўқ");
  }
}

export async function toggleModuleGrantAction(formData: FormData) {
  await requireAdmin();

  const role = formData.get("role") as Role;
  const moduleKey = formData.get("module") as ModuleKey;
  const nextGranted = formData.get("nextGranted") === "1";

  if (!GRANTABLE_ROLES.includes(role)) return;
  // Admin must never be able to lock itself out of user management — that's
  // the one screen that could undo the mistake.
  if (role === "ADMIN" && moduleKey === "USER_MANAGEMENT" && !nextGranted) return;

  if (nextGranted) {
    await prisma.rolePermission.upsert({
      where: { role_module: { role, module: moduleKey } },
      create: { role, module: moduleKey },
      update: {},
    });
  } else {
    await prisma.rolePermission.deleteMany({ where: { role, module: moduleKey } });
  }

  revalidatePath("/admin/access");
}
