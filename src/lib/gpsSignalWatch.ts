// A GPS tracker that goes quiet for a long stretch is worth flagging on its
// own, separate from movement detection (gpsMovementWatch.ts) — a dead
// battery or lost GSM signal is the ordinary explanation, but a physically
// disconnected tracker (often the first step before an unauthorized trip)
// looks identical from here, so it's always worth someone checking.
export const SIGNAL_LOST_THRESHOLD_MINUTES = 120;

export function isSignalLost(lastUpdate: Date, now: Date): boolean {
  return (now.getTime() - lastUpdate.getTime()) / 60_000 > SIGNAL_LOST_THRESHOLD_MINUTES;
}
