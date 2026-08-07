import type { VehicleStatus } from "@prisma/client";

// A vehicle counts as working fleet — dispatchable for trips, GPS-tracked,
// counted in fuel-efficiency/mileage/overhead-share reports — unless it's
// genuinely unavailable: physically under repair or handed off on a rental.
// NOT_ON_LINE/ON_ORDER are informational (what the vehicle is doing right
// now), not a hard gate, so they stay in this set.
export const DISPATCHABLE_STATUSES: VehicleStatus[] = ["ACTIVE", "NOT_ON_LINE", "ON_ORDER"];
