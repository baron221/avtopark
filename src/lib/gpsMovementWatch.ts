// Distance-based "did this vehicle move since we last checked" test for
// vehicles that are currently NOT_ON_LINE and therefore shouldn't be moving
// at all — see /api/gps/movement-watch, which calls this once per vehicle on
// every run. Pure geometry, no I/O, so it's unit-testable on its own.

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// A parked vehicle's reported position still jitters a little (multipath
// reflection, a few meters of receiver noise) even standing still — 150m
// comfortably clears that noise floor while still catching a real short
// drive within one ~10-15 minute check interval.
export const MOVEMENT_THRESHOLD_METERS = 150;

export function hasMoved(last: { lat: number; lon: number }, current: { lat: number; lon: number }): boolean {
  return haversineMeters(last, current) > MOVEMENT_THRESHOLD_METERS;
}
