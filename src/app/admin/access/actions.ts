"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GRANTABLE_MODULES, type GrantableModule } from "@/lib/access";
import type { Role } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Ruxsat yo'q");
  }
}

export async function toggleModuleGrantAction(formData: FormData) {
  await requireAdmin();

  const role = formData.get("role") as Role;
  const moduleKey = formData.get("module") as GrantableModule;
  const nextGranted = formData.get("nextGranted") === "1";

  const config = GRANTABLE_MODULES.find((m) => m.key === moduleKey);
  if (!config || !config.grantableRoles.includes(role)) return;

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
