import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWialonUnits, getWialonMileageForRange, matchVehiclesToWialonUnits } from "@/lib/wialon";

// Triggered once daily by Vercel Cron (see vercel.json) shortly after UTC
// midnight, so "yesterday" here means the UTC calendar day that just ended —
// the same day-boundary convention every other "today" field in this app
// already uses (Lunch, Trip, ...), since the server itself runs in UTC.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  const vehicles = await prisma.vehicle.findMany({ where: { status: "ACTIVE" }, select: { id: true, plate: true } });
  const units = await getWialonUnits();
  const gpsMap = matchVehiclesToWialonUnits(vehicles, units);

  let written = 0;
  for (const vehicle of vehicles) {
    const unit = gpsMap.get(vehicle.id);
    if (!unit) continue;
    const km = await getWialonMileageForRange(unit.id, yesterdayStart, todayStart);
    await prisma.vehicleMileage.upsert({
      where: { vehicleId_date: { vehicleId: vehicle.id, date: yesterdayStart } },
      create: { vehicleId: vehicle.id, date: yesterdayStart, km },
      update: { km },
    });
    written++;
  }

  return NextResponse.json({ ok: true, date: yesterdayStart.toISOString(), vehicles: vehicles.length, written });
}
