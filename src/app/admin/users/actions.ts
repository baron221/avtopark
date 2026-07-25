"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Point, Role, SalaryType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Ruxsat yo'q");
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
    return { error: "Barcha maydonlarni to'ldiring" };
  }
  if (password.length < 6) {
    return { error: "Parol kamida 6 belgidan iborat bo'lishi kerak" };
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return { error: "Bu telefon raqam bilan foydalanuvchi allaqachon mavjud" };
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

export async function toggleActiveAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  revalidatePath("/admin/users");
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
    return { error: "Parol kamida 6 belgidan iborat bo'lishi kerak", success: false };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/admin/users");
  return { error: "", success: true };
}
