import { prisma } from "@/lib/prisma";

export type ExternalVehicleRow = { id: string; plate: string };

export async function getExternalVehicles(): Promise<ExternalVehicleRow[]> {
  return prisma.externalVehicle.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true } });
}
