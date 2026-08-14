import type { GpsTripDirection } from "@prisma/client";

export type GpsPoint = { t: Date; lat: number; lon: number };

export type DetectedTransit = { direction: GpsTripDirection; detectedAt: Date };

// Real coordinates of the two terminals the fleet shuttles between — see
// the client's own GPS pin drop, not an approximation. Cross-checked
// against a real vehicle's August 13 track: GPS detected 8 station-to-
// station transits that day, and the dispatcher had independently logged
// exactly 8 Trip records for the same vehicle/day, with GPS arrival times
// consistently ~20-40 minutes after the dispatcher's entry timestamp
// (matches "dispatcher logs it at departure, GPS confirms on arrival").
export const FARGONA_STATION = { lat: 40.38872378354224, lon: 71.79157403744323 };
export const QUVA_STATION = { lat: 40.525118652440064, lon: 72.06753608844146 };

// Radius the detector treats as "at the station" — verified stable across
// 200m/400m/600m on real tracks (near-identical transit counts at each),
// so the vehicles genuinely converge tightly on these two points rather
// than merely passing nearby; 400m keeps a little slack.
const STATION_RADIUS_M = 400;

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function stationAt(point: { lat: number; lon: number }): "FARGONA" | "QUVA" | null {
  if (haversineMeters(FARGONA_STATION, point) <= STATION_RADIUS_M) return "FARGONA";
  if (haversineMeters(QUVA_STATION, point) <= STATION_RADIUS_M) return "QUVA";
  return null;
}

/**
 * Walks a vehicle's GPS track (must already be in chronological order) and
 * emits one event per genuine station-to-station transit: the vehicle was
 * last seen "at" one station, then is later seen "at" the other one. Points
 * outside both geofences (i.e. mid-route) don't change the tracked state,
 * so a GPS gap mid-journey doesn't break detection — only arriving at the
 * *other* station counts, which also makes it immune to jitter right at a
 * station boundary (re-entering the same station's radius is a no-op).
 */
export function detectStationTransits(points: GpsPoint[]): DetectedTransit[] {
  const events: DetectedTransit[] = [];
  let lastStation: "FARGONA" | "QUVA" | null = null;

  for (const point of points) {
    const station = stationAt(point);
    if (!station || station === lastStation) continue;

    if (lastStation === "FARGONA" && station === "QUVA") {
      events.push({ direction: "FARGONA_TO_QUVA", detectedAt: point.t });
    } else if (lastStation === "QUVA" && station === "FARGONA") {
      events.push({ direction: "QUVA_TO_FARGONA", detectedAt: point.t });
    }
    lastStation = station;
  }

  return events;
}
