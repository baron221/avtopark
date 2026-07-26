import { prisma } from "@/lib/prisma";

// Always represented as a UTC midnight timestamp so two processes running in
// different timezones (e.g. a local dev machine vs. Vercel's UTC serverless
// functions) construct the exact same Date for "July 2026", instead of
// silently drifting apart and failing the DB's exact-match unique lookup.
export function currentMonthDate(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/**
 * Driver.vehicleId (the permanent "who currently drives this vehicle" pointer,
 * used everywhere else in the app) and the current month's Shift row used to
 * be assignable independently, so one screen could show a driver the other
 * screen had already reassigned elsewhere. This keeps them in lockstep
 * whenever the change touches the current month.
 */
export async function syncDriverVehicleAssignment(vehicleId: string, driverId: string | null): Promise<void> {
  const month = currentMonthDate();

  await prisma.$transaction(async (tx) => {
    await tx.driver.updateMany({ where: { vehicleId }, data: { vehicleId: null } });
    await tx.shift.deleteMany({ where: { vehicleId, month } });

    if (driverId) {
      // A driver can only be driving one vehicle at a time.
      await tx.shift.deleteMany({ where: { driverId, month, NOT: { vehicleId } } });
      await tx.driver.update({ where: { id: driverId }, data: { vehicleId } });
      await tx.shift.create({ data: { vehicleId, driverId, month } });
    }
  });
}

/**
 * Used by the Smenalar pages. For the current month this goes through
 * syncDriverVehicleAssignment so it can't drift from Driver.vehicleId; for a
 * past/future month it just edits that month's Shift row on its own, since
 * the permanent pointer only ever tracks "now".
 */
export async function applyShiftAssignment(vehicleId: string, month: Date, driverId: string | null): Promise<void> {
  if (isSameMonth(month, currentMonthDate())) {
    await syncDriverVehicleAssignment(vehicleId, driverId);
    return;
  }

  if (!driverId) {
    await prisma.shift.deleteMany({ where: { vehicleId, month } });
  } else {
    await prisma.shift.upsert({
      where: { vehicleId_month: { vehicleId, month } },
      create: { vehicleId, driverId, month },
      update: { driverId },
    });
  }
}
