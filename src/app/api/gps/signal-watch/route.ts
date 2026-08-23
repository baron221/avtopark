import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWialonUnits, matchVehiclesToWialonUnits } from "@/lib/wialon";
import { isSignalLost } from "@/lib/gpsSignalWatch";
import { notifyRole } from "@/lib/telegram";

// Triggered externally (GitHub Actions, every ~10-15 min) alongside
// movement-watch — see that route's own comment for why Vercel Cron isn't
// used here. Checks every fleet vehicle, not just NOT_ON_LINE ones: a
// tracker going quiet is worth knowing about regardless of the vehicle's
// current status.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await prisma.vehicle.findMany({ select: { id: true, plate: true, model: true } });
  const units = await getWialonUnits();
  const unitMap = matchVehiclesToWialonUnits(vehicles, units);
  const existingAlerts = await prisma.vehicleSignalAlert.findMany();
  const alertedIds = new Set(existingAlerts.map((a) => a.vehicleId));

  const now = new Date();
  let alerted = 0;
  let recovered = 0;

  for (const vehicle of vehicles) {
    const unit = unitMap.get(vehicle.id);
    if (!unit) continue;

    const lost = isSignalLost(unit.lastUpdate, now);
    const alreadyAlerted = alertedIds.has(vehicle.id);

    if (lost && !alreadyAlerted) {
      const hoursAgo = ((now.getTime() - unit.lastUpdate.getTime()) / 3_600_000).toFixed(1);
      await notifyRole(
        "MECHANIC",
        `📡 <b>${vehicle.plate}</b> (${vehicle.model}) GPS'дан ${hoursAgo} соатдан бери сигнал йўқ.\n\n` +
          `Трекер ўчган, батареяси тугаган ёки алоқа йўқ бўлиши мумкин — текшириб кўринг.`
      );
      await prisma.vehicleSignalAlert.create({ data: { vehicleId: vehicle.id, alertedAt: now } });
      alerted++;
    } else if (!lost && alreadyAlerted) {
      // Signal resumed — clear the alert so a future outage starts fresh.
      await prisma.vehicleSignalAlert.delete({ where: { vehicleId: vehicle.id } });
      recovered++;
    }
  }

  return NextResponse.json({ ok: true, checked: vehicles.length, alerted, recovered });
}
