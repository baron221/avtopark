import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWialonUnits, matchVehiclesToWialonUnits } from "@/lib/wialon";
import { hasMoved } from "@/lib/gpsMovementWatch";
import { isSignalLost } from "@/lib/gpsSignalWatch";
import { notifyRole } from "@/lib/telegram";

// Merges the two previously-separate /api/gps/movement-watch and
// /api/gps/signal-watch routes into one. GitHub Actions calls this every
// ~10 minutes (see .github/workflows/gps-watch.yml) — the two checks used
// to run as two independent invocations, each fetching the exact same
// Wialon unit list on its own. That doubled both the serverless invocation
// count and the Wialon calls for no benefit (same data, same fleet), which
// showed up as this project alone accounting for ~94% of the Vercel
// account's Fluid Active CPU usage. Folding both checks into one request
// halves both without changing any alerting behavior.
const WATCHED_STATUS = "NOT_ON_LINE";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [vehicles, existingMovementWatches, existingSignalAlerts] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, plate: true, model: true, status: true } }),
    prisma.vehicleMovementWatch.findMany(),
    prisma.vehicleSignalAlert.findMany(),
  ]);

  const watchedVehicles = vehicles.filter((v) => v.status === WATCHED_STATUS);
  const watchedIds = watchedVehicles.map((v) => v.id);

  // Same reset-on-status-change reasoning as the old movement-watch route:
  // a vehicle that left NOT_ON_LINE starts fresh next time it re-enters.
  await prisma.vehicleMovementWatch.deleteMany({ where: { vehicleId: { notIn: watchedIds } } });

  // The one Wialon fetch both checks share.
  const units = await getWialonUnits();
  const unitMap = matchVehiclesToWialonUnits(vehicles, units);

  // --- Movement watch: only vehicles currently marked NOT_ON_LINE. ---
  const watchByVehicle = new Map(existingMovementWatches.map((w) => [w.vehicleId, w]));
  let movementAlerted = 0;
  for (const vehicle of watchedVehicles) {
    const unit = unitMap.get(vehicle.id);
    if (!unit) continue;

    const existing = watchByVehicle.get(vehicle.id);
    if (!existing) {
      await prisma.vehicleMovementWatch.create({
        data: { vehicleId: vehicle.id, lastLat: unit.lat, lastLon: unit.lon },
      });
      continue;
    }

    const alreadyAlerted = !!existing.alertedAt;
    const moved = hasMoved({ lat: existing.lastLat, lon: existing.lastLon }, { lat: unit.lat, lon: unit.lon });

    if (moved && !alreadyAlerted) {
      const mapsUrl = `https://maps.google.com/?q=${unit.lat},${unit.lon}`;
      await notifyRole(
        ["OWNER", "MECHANIC"],
        `⚠️ <b>${vehicle.plate}</b> (${vehicle.model}) линияда эмас деб белгиланган, лекин жойидан қўзғалди.\n\n` +
          `Ҳозирги жойлашуви: ${mapsUrl}\n` +
          `Тезлик: ${unit.speedKmh} км/соат`
      );
      movementAlerted++;
    }

    await prisma.vehicleMovementWatch.update({
      where: { vehicleId: vehicle.id },
      data: {
        lastLat: unit.lat,
        lastLon: unit.lon,
        alertedAt: moved && !alreadyAlerted ? new Date() : existing.alertedAt,
      },
    });
  }

  // --- Signal watch: every fleet vehicle, regardless of status. ---
  const alertedIds = new Set(existingSignalAlerts.map((a) => a.vehicleId));
  const now = new Date();
  let signalAlerted = 0;
  let signalRecovered = 0;
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
      signalAlerted++;
    } else if (!lost && alreadyAlerted) {
      await prisma.vehicleSignalAlert.delete({ where: { vehicleId: vehicle.id } });
      signalRecovered++;
    }
  }

  return NextResponse.json({
    ok: true,
    watched: watchedVehicles.length,
    movementAlerted,
    checked: vehicles.length,
    signalAlerted,
    signalRecovered,
  });
}
