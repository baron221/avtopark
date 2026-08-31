import { NextResponse } from "next/server";
import { notifyRole } from "@/lib/telegram";
import { buildOilDueReport } from "@/lib/telegramReports";

// Runs once daily (see .github/workflows/daily-alerts.yml). Pushes once a
// vehicle enters the warning zone (within 500km of its next change), not
// just once it's fully overdue — real lead time to schedule the change
// instead of finding out the same day it's due. Re-alerts every day a
// vehicle stays in that zone — unlike the GPS alerts, that's the point: a
// maintenance reminder should keep nagging until the oil is actually
// changed, not fire once and go silent. Vehicles with no OilChange history
// yet are skipped — there's no baseline to compute a due date from.
// Km-only, same as the mechanic vehicle page's own warning badge — a
// vehicle sitting unused for a while shouldn't be flagged just because
// time passed with no distance driven. Only pushes when something needs
// attention — see /moy (api/telegram/webhook) for an unconditional,
// on-demand version of this same report covering every vehicle.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, hasIssue } = await buildOilDueReport();
  if (hasIssue) await notifyRole("MECHANIC", message);

  return NextResponse.json({ ok: true, hasIssue });
}
