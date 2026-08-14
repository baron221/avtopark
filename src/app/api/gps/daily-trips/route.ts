import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWialonUnits, getWialonTrackForRange, matchVehiclesToWialonUnits } from "@/lib/wialon";
import { detectStationTransits } from "@/lib/gpsTripDetection";
import { DISPATCHABLE_STATUSES } from "@/lib/vehicleStatus";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  const vehicles = await prisma.vehicle.findMany({
    where: { status: { in: DISPATCHABLE_STATUSES } },
    select: { id: true, plate: true },
  });
  const units = await getWialonUnits();
  const gpsMap = matchVehiclesToWialonUnits(vehicles, units);

  let written = 0;
  for (const vehicle of vehicles) {
    const unit = gpsMap.get(vehicle.id);
    if (!unit) continue;

    const points = await getWialonTrackForRange(unit.id, yesterdayStart, todayStart);
    const transits = detectStationTransits(points);

    // Delete-then-recreate this vehicle's window so a cron re-run (manual
    // retry, redeploy) doesn't double-insert the same detected transits.
    await prisma.$transaction([
      prisma.gpsDetectedTrip.deleteMany({
        where: { vehicleId: vehicle.id, detectedAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.gpsDetectedTrip.createMany({
        data: transits.map((t) => ({ vehicleId: vehicle.id, direction: t.direction, detectedAt: t.detectedAt })),
      }),
    ]);
    written += transits.length;
  }

  return NextResponse.json({ ok: true, date: yesterdayStart.toISOString(), vehicles: vehicles.length, written });
}
