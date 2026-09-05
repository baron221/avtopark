import { prisma } from "@/lib/prisma";
import type { Vehicle, Driver, User } from "@prisma/client";

export type DriverWithUser = Driver & { user: User };
export type VehicleWithDriver = Vehicle & { driver: DriverWithUser | null };

/**
 * Same rows as `vehicle.findMany({ include: { driver: { include: { user:
 * true } } } })`, but as two flat queries joined here in JS instead of one
 * doubly-nested include — a single such query was measured at ~1.9s against
 * this project's high-latency DB region (see dashboard.ts's own
 * getOwnerDashboardVM comment), vs a fraction of that run concurrently.
 * Both tables are small (~20-30 rows total), so fetching each in full and
 * joining here is cheap regardless of how many a caller actually needs —
 * callers filter/sort the result in JS instead of passing a `where`.
 *
 * Returns the flat `drivers` list too (not just vehicle.driver): a Trip's
 * own driverId is the driver who actually made *that* trip, which can
 * differ from whoever the vehicle is *currently* assigned to after a
 * reassignment — looking that up via vehicle.driver instead of this list
 * would silently attribute a past trip to the wrong person.
 */
export async function getVehiclesAndDrivers(): Promise<{ vehicles: VehicleWithDriver[]; drivers: DriverWithUser[] }> {
  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany(),
    prisma.driver.findMany({ include: { user: true } }),
  ]);
  const driverByVehicleId = new Map(drivers.filter((d) => d.vehicleId).map((d) => [d.vehicleId as string, d]));
  const vehiclesWithDriver = vehicles.map((v) => ({ ...v, driver: driverByVehicleId.get(v.id) ?? null }));
  return { vehicles: vehiclesWithDriver, drivers };
}

/** Convenience for the common case of only needing the vehicle+driver join
 * (no separate by-driverId lookup). */
export async function getVehiclesWithDriver(): Promise<VehicleWithDriver[]> {
  return (await getVehiclesAndDrivers()).vehicles;
}
