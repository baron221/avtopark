"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/access";
import type { Point, VehicleType } from "@prisma/client";

export type CreateVehicleState = { error: string };

export async function createVehicleAction(
  _prevState: CreateVehicleState,
  formData: FormData
): Promise<CreateVehicleState> {
  const session = await auth();
  if (!session || (session.user.role !== "MECHANIC" && !(await hasModuleAccess(session.user.role, "VEHICLES")))) {
    return { error: "Рухсат йўқ" };
  }

  const plate = String(formData.get("plate") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const type = formData.get("type") as VehicleType;
  const seats = Math.round(Number(formData.get("seats") ?? 0));
  const purchasePrice = Math.round(Number(formData.get("purchasePrice") ?? 0));
  const point = (formData.get("point") as Point | null) || null;

  if (!plate || !model || !(seats > 0) || !(purchasePrice > 0)) {
    return { error: "Барча майдонларни тўғри тўлдиринг" };
  }

  const existing = await prisma.vehicle.findUnique({ where: { plate } });
  if (existing) {
    return { error: "Бу давлат рақами билан машина аллақачон мавжуд" };
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      plate,
      model,
      type,
      seats,
      point,
      status: "ACTIVE",
      purchasePrice: BigInt(purchasePrice),
      purchaseDate: new Date(),
    },
  });

  revalidatePath("/mechanic/vehicles");
  redirect(`/mechanic/vehicles/${vehicle.id}`);
}
