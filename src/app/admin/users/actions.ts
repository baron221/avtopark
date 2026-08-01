"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import type { Point, Role, SalaryType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && !(await hasModuleAccess(session.user.role, "USER_MANAGEMENT")))) {
    throw new Error("Рухсат йўқ");
  }
  return session;
}

export type CreateUserState = { error: string };

export async function createUserAction(_prevState: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") as Role;
  const point = (formData.get("point") as Point | null) || null;

  if (!fullName || !phone || !password || !role) {
    return { error: "Барча майдонларни тўлдиринг" };
  }
  if (password.length < 6) {
    return { error: "Парол камида 6 белгидан иборат бўлиши керак" };
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return { error: "Бу телефон рақам билан фойдаланувчи аллақачон мавжуд" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      fullName,
      phone,
      role,
      point: role === "DISPATCHER" ? point : null,
      passwordHash,
    },
  });

  if (role === "DRIVER") {
    const licenseNo = String(formData.get("licenseNo") ?? "").trim();
    const salaryType = (formData.get("salaryType") as SalaryType) || "FIXED";
    const rawSalaryValue = Number(formData.get("salaryValue"));
    const salaryValue = Number.isFinite(rawSalaryValue) ? Math.max(0, rawSalaryValue) : 0;
    await prisma.driver.create({
      data: {
        userId: user.id,
        licenseNo: licenseNo || "—",
        salaryType,
        salaryValue,
        hiredAt: new Date(),
      },
    });
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export type UpdateUserState = { error: string };

export async function updateUserAction(
  _prevState: UpdateUserState,
  formData: FormData
): Promise<UpdateUserState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const point = (formData.get("point") as Point | null) || null;
  const rawBaseSalary = formData.get("baseSalary");
  const baseSalary =
    rawBaseSalary !== null && String(rawBaseSalary).trim() !== "" ? Math.max(0, Math.round(Number(rawBaseSalary))) : null;

  if (!userId || !fullName || !phone) {
    return { error: "Барча майдонларни тўлдиринг" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { driver: true } });
  if (!user) {
    return { error: "Фойдаланувчи топилмади" };
  }

  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone && existingPhone.id !== userId) {
    return { error: "Бу телефон рақам билан бошқа фойдаланувчи аллақачон мавжуд" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      fullName,
      phone,
      point: user.role === "DISPATCHER" ? point : null,
      baseSalary: baseSalary !== null ? BigInt(baseSalary) : null,
    },
  });

  if (user.role === "DRIVER" && user.driver) {
    const licenseNo = String(formData.get("licenseNo") ?? "").trim();
    const salaryType = (formData.get("salaryType") as SalaryType) || user.driver.salaryType;
    const rawSalaryValue = Number(formData.get("salaryValue"));
    const salaryValue = Number.isFinite(rawSalaryValue) ? Math.max(0, rawSalaryValue) : Number(user.driver.salaryValue);
    await prisma.driver.update({
      where: { id: user.driver.id },
      data: { licenseNo: licenseNo || user.driver.licenseNo, salaryType, salaryValue },
    });
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function toggleActiveAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const page = String(formData.get("page") ?? "").trim();
  const backTo = `/admin/users${page && page !== "1" ? `?page=${page}` : ""}`;

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { driver: true } });
  if (!user) redirect(backTo);

  if (userId === session.user.id) {
    redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}deleteError=${encodeURIComponent("Ўзингизни ўчира олмайсиз")}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (user.driver) {
        await tx.driver.delete({ where: { id: user.driver.id } });
      }
      await tx.user.delete({ where: { id: userId } });
    });
  } catch {
    // Has trips/expenses/salary/fine/advance history etc. — deleting would
    // either fail on a foreign key or silently erase financial records, so
    // block it and point them at Bloklash instead.
    const message = `${user.fullName} тизимда тарихга эга (рейс, харажат, маош ва ҳ.к.), шунинг учун ўчириб бўлмайди. Бунинг ўрнига "Блоклаш"дан фойдаланинг.`;
    redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}deleteError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/users");
  redirect(backTo);
}

export type ResetPasswordState = { error: string; success: boolean };

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    return { error: "Парол камида 6 белгидан иборат бўлиши керак", success: false };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/admin/users");
  return { error: "", success: true };
}
