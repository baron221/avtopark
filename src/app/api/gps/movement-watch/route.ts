import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWialonUnits, matchVehiclesToWialonUnits } from "@/lib/wialon";
import { hasMoved } from "@/lib/gpsMovementWatch";
import { notifyRole } from "@/lib/telegram";

// Triggered externally (GitHub Actions, every ~10-15 min) rather than
// Vercel Cron — Vercel's own cron only runs once/day on this project's plan,
// far too coarse for "alert us while it's still driving away". Same
// Authorization: Bearer <CRON_SECRET> convention as daily-trips/daily-mileage
// either way, so it doesn't matter to this route who the caller is.
const WATCHED_STATUS = "NOT_ON_LINE";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watchedVehicles = await prisma.vehicle.findMany({
    where: { status: WATCHED_STATUS },
    select: { id: true, plate: true, model: true },
  });
  const watchedIds = watchedVehicles.map((v) => v.id);

  // A vehicle that left NOT_ON_LINE since the last run (dispatched again,
  // or moved to REPAIR/etc.) starts fresh next time it re-enters that
  // status, rather than staying permanently muted by an old alertedAt from
  // a previous episode.
  await prisma.vehicleMovementWatch.deleteMany({ where: { vehicleId: { notIn: watchedIds } } });

  if (watchedVehicles.length === 0) {
    return NextResponse.json({ ok: true, watched: 0, alerted: 0 });
  }

  const [units, existingWatches] = await Promise.all([
    getWialonUnits(),
    prisma.vehicleMovementWatch.findMany({ where: { vehicleId: { in: watchedIds } } }),
  ]);
  const unitMap = matchVehiclesToWialonUnits(watchedVehicles, units);
  const watchByVehicle = new Map(existingWatches.map((w) => [w.vehicleId, w]));

  let alerted = 0;
  for (const vehicle of watchedVehicles) {
    const unit = unitMap.get(vehicle.id);
    if (!unit) continue;

    const existing = watchByVehicle.get(vehicle.id);
    if (!existing) {
      // First time seeing this vehicle in NOT_ON_LINE (or its first check
      // ever) — nothing to compare against yet, just record where it is.
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
        "OWNER",
        `⚠️ <b>${vehicle.plate}</b> (${vehicle.model}) линияда эмас деб белгиланган, лекин жойидан қўзғалди.\n\n` +
          `Ҳозирги жойлашуви: ${mapsUrl}\n` +
          `Тезлик: ${unit.speedKmh} км/соат`
      );
      alerted++;
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

  return NextResponse.json({ ok: true, watched: watchedVehicles.length, alerted });
}
