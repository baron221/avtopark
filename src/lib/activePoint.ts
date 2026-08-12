import { cookies } from "next/headers";
import type { Point } from "@prisma/client";

/** Dispatchers physically rotate between Farg'ona and Quva, so "which point
 * am I working right now" can differ from a dispatcher's assigned home
 * point (User.point) day to day. Rather than update that DB field — which
 * would need a re-login to show up, since point is baked into the JWT at
 * sign-in — the currently-active point lives in this cookie instead, set
 * via setActivePointAction (src/app/dispatcher/actions.ts) and read
 * everywhere a real dispatcher's point matters. Falls back to their home
 * point until they explicitly switch. Guests (granted module access, no
 * home point at all) are unrelated to this — they keep picking a point
 * per-visit via the `?point=` query param instead.
 *
 * The value is "{userId}:{point}", not just the point — cookies aren't
 * cleared on logout, so on a shared device (a real scenario: two
 * dispatchers, one office computer) a bare point value would silently
 * carry over from whoever logged in previously into the next dispatcher's
 * session, misattributing their trips/expenses/handovers to the wrong
 * point. Only trusted when the encoded userId matches the current session. */
export const ACTIVE_POINT_COOKIE = "active_point";

export async function getActivePoint(userId: string, homePoint: Point): Promise<Point> {
  const store = await cookies();
  const raw = store.get(ACTIVE_POINT_COOKIE)?.value ?? "";
  const [ownerId, point] = raw.split(":");
  if (ownerId === userId && (point === "FARGONA" || point === "QUVA")) return point;
  return homePoint;
}
