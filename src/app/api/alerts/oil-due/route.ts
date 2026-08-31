import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/telegram";

// Runs once daily (see .github/workflows/daily-alerts.yml). Re-alerts every
// day a vehicle stays overdue — unlike the GPS alerts, that's the point:
// a maintenance reminder should keep nagging until the oil is actually
// changed, not fire once and go silent. Vehicles with no OilChange history
// yet are skipped — there's no baseline to compute a due date from.
// Km-only, same as the mechanic vehicle page's own warning badge — a
// vehicle sitting unused for a while shouldn't be flagged just because
// time passed with no distance driven.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await prisma.vehicle.findMany({ select: { id: true, plate: true, model: true, odometerKm: true } });
  const oilChanges = await prisma.oilChange.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) } },
    orderBy: { changedAt: "desc" },
    select: { vehicleId: true, odometerKm: true, intervalKm: true },
  });
  const latestByVehicle = new Map<string, (typeof oilChanges)[number]>();
  for (const oc of oilChanges) {
    if (!latestByVehicle.has(oc.vehicleId)) latestByVehicle.set(oc.vehicleId, oc);
  }

  const due: { plate: string; model: string }[] = [];

  for (const vehicle of vehicles) {
    const last = latestByVehicle.get(vehicle.id);
    if (!last) continue;

    const dueKm = last.odometerKm + last.intervalKm;
    const overdueByKm = vehicle.odometerKm != null && vehicle.odometerKm >= dueKm;

    if (overdueByKm) {
      due.push({ plate: vehicle.plate, model: vehicle.model });
    }
  }

  if (due.length > 0) {
    const list = due.map((v) => `• <b>${v.plate}</b> (${v.model})`).join("\n");
    await notifyRole("MECHANIC", `🔧 Мой алмаштириш муддати етган машиналар:\n\n${list}`);
  }

  return NextResponse.json({ ok: true, due: due.length });
}
