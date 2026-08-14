// Wialon Remote API client for our local/self-hosted instance
// (https://sdk.wialon.com/wiki/en/kit/remoteapi/apiref/token/login). Session
// ids expire after 5 minutes of inactivity, so the cached id is discarded
// and a fresh login retried once on any failure rather than trusted blindly.

export type WialonUnit = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  speedKmh: number;
  courseDeg: number;
  satellites: number;
  lastUpdate: Date;
};

let cachedSid: string | null = null;

async function call<T = unknown>(svc: string, params: unknown, sid?: string): Promise<T> {
  const baseUrl = process.env.WIALON_BASE_URL;
  if (!baseUrl) throw new Error("WIALON_BASE_URL .env da yo'q");

  let url = `${baseUrl}/wialon/ajax.html?svc=${svc}&params=${encodeURIComponent(JSON.stringify(params))}`;
  if (sid) url += `&sid=${sid}`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

async function login(): Promise<string> {
  const token = process.env.WIALON_TOKEN;
  if (!token) throw new Error("WIALON_TOKEN .env da yo'q");

  const data = await call<{ eid?: string; error?: number }>("token/login", { token, fl: 1 });
  if (!data.eid) throw new Error(`Wialon login xato: ${JSON.stringify(data)}`);
  cachedSid = data.eid;
  return cachedSid;
}

async function callAuthed<T = unknown>(svc: string, params: unknown): Promise<T> {
  const sid = cachedSid ?? (await login());
  const data = await call<T & { error?: number }>(svc, params, sid);
  if (data?.error) {
    // Session likely expired — retry once with a fresh login. If the retry
    // still errors (e.g. the self-hosted server's error 1003, thrown back
    // when too many messages/load_interval calls land concurrently), throw
    // instead of returning the errored payload — callers coerce a missing
    // `messages`/`items` field into an empty array, which would otherwise
    // silently read as "no GPS activity" rather than "the fetch failed".
    const freshSid = await login();
    const retried = await call<T & { error?: number }>(svc, params, freshSid);
    if (retried?.error) throw new Error(`Wialon xato (${svc}): ${JSON.stringify(retried)}`);
    return retried;
  }
  return data;
}

type WialonSearchItem = {
  id: number;
  nm: string;
  pos?: { y: number; x: number; s: number; c: number; sc: number; t: number };
};

/** Live position for every unit (vehicle) visible to this Wialon account. */
export async function getWialonUnits(): Promise<WialonUnit[]> {
  const data = await callAuthed<{ items?: WialonSearchItem[] }>("core/search_items", {
    spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
    force: 1,
    flags: 1025, // 1: base info, 1024: last position
    from: 0,
    to: 0,
  });

  return (data.items ?? [])
    .filter((item): item is WialonSearchItem & { pos: NonNullable<WialonSearchItem["pos"]> } => !!item.pos)
    .map((item) => ({
      id: item.id,
      name: item.nm,
      lat: item.pos.y,
      lon: item.pos.x,
      speedKmh: item.pos.s,
      courseDeg: item.pos.c,
      satellites: item.pos.sc,
      lastUpdate: new Date(item.pos.t * 1000),
    }));
}

/** Looks up a single unit by plate, filtering server-side so a single
 * vehicle page doesn't have to pull every unit in the account. */
export async function getWialonUnitByPlate(plate: string): Promise<WialonUnit | null> {
  const data = await callAuthed<{ items?: WialonSearchItem[] }>("core/search_items", {
    spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: `*${plate}*`, sortType: "sys_name" },
    force: 1,
    flags: 1025,
    from: 0,
    to: 0,
  });
  const item = (data.items ?? []).find((i) => !!i.pos);
  if (!item?.pos) return null;
  return {
    id: item.id,
    name: item.nm,
    lat: item.pos.y,
    lon: item.pos.x,
    speedKmh: item.pos.s,
    courseDeg: item.pos.c,
    satellites: item.pos.sc,
    lastUpdate: new Date(item.pos.t * 1000),
  };
}

/**
 * Matches our Vehicle rows to Wialon units by plate — unit names are
 * "{brand} {plate}" (e.g. "JAC 40 056 RCA"), and our plates ("40 056 RCA")
 * appear verbatim inside them, so a substring check is enough. A few real
 * unit names have doubled internal spaces (e.g. "JAC 40 260  RCA") that
 * silently broke this match, so whitespace is collapsed on both sides first.
 */
export function matchVehiclesToWialonUnits(
  vehicles: { id: string; plate: string }[],
  units: WialonUnit[]
): Map<string, WialonUnit> {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const map = new Map<string, WialonUnit>();
  for (const vehicle of vehicles) {
    const plate = normalize(vehicle.plate);
    const unit = units.find((u) => normalize(u.name).includes(plate));
    if (unit) map.set(vehicle.id, unit);
  }
  return map;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sums a unit's GPS track between two instants into a driven-distance
 * estimate. loadCount defaults to comfortably cover a single day (~1500-3000
 * messages observed); a caller summing a much longer range (e.g. a full
 * month, ~90k-110k messages observed) must raise it or risk silent
 * truncation.
 */
export async function getWialonMileageForRange(
  unitId: number,
  from: Date,
  to: Date,
  loadCount = 20000
): Promise<number> {
  const data = await callAuthed<{ messages?: { pos?: { y: number; x: number } }[] }>("messages/load_interval", {
    itemId: unitId,
    timeFrom: Math.floor(from.getTime() / 1000),
    timeTo: Math.floor(to.getTime() / 1000),
    flags: 0,
    flagsMask: 0,
    loadCount,
  });

  const points = (data.messages ?? [])
    .map((m) => m.pos)
    .filter((p): p is { y: number; x: number } => !!p)
    .map((p) => ({ lat: p.y, lon: p.x }));

  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
}

/**
 * A unit's raw, timestamped GPS track between two instants, in chronological
 * order — for callers that need the actual points (e.g. station-arrival
 * detection in gpsTripDetection.ts), not just a summed distance. Same
 * loadCount ceiling/caveat as getWialonMileageForRange.
 */
export async function getWialonTrackForRange(
  unitId: number,
  from: Date,
  to: Date,
  loadCount = 20000
): Promise<{ t: Date; lat: number; lon: number }[]> {
  const data = await callAuthed<{ messages?: { t?: number; pos?: { y: number; x: number } }[] }>(
    "messages/load_interval",
    {
      itemId: unitId,
      timeFrom: Math.floor(from.getTime() / 1000),
      timeTo: Math.floor(to.getTime() / 1000),
      flags: 0,
      flagsMask: 0,
      loadCount,
    }
  );

  return (data.messages ?? [])
    .filter((m): m is { t: number; pos: { y: number; x: number } } => !!m.pos && !!m.t)
    .map((m) => ({ t: new Date(m.t * 1000), lat: m.pos.y, lon: m.pos.x }))
    .sort((a, b) => a.t.getTime() - b.t.getTime());
}

/** Sums today's GPS track (midnight so far) into a driven-distance estimate. */
export async function getWialonMileageToday(unitId: number): Promise<number> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return getWialonMileageForRange(unitId, from, now);
}

/** Today's driven distance and peak recorded speed, from a single GPS-track load. */
export async function getWialonTodayStats(unitId: number): Promise<{ kmToday: number; maxSpeedKmh: number }> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const data = await callAuthed<{ messages?: { pos?: { y: number; x: number; s: number } }[] }>(
    "messages/load_interval",
    {
      itemId: unitId,
      timeFrom: Math.floor(from.getTime() / 1000),
      timeTo: Math.floor(now.getTime() / 1000),
      flags: 0,
      flagsMask: 0,
      loadCount: 20000,
    }
  );

  const points = (data.messages ?? [])
    .map((m) => m.pos)
    .filter((p): p is { y: number; x: number; s: number } => !!p);

  let kmToday = 0;
  let maxSpeedKmh = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].s > maxSpeedKmh) maxSpeedKmh = points[i].s;
    if (i > 0) kmToday += haversineKm({ lat: points[i - 1].y, lon: points[i - 1].x }, { lat: points[i].y, lon: points[i].x });
  }
  return { kmToday, maxSpeedKmh: Math.round(maxSpeedKmh) };
}

// The self-hosted Wialon instance starts rejecting messages/load_interval
// calls with error 1003 once ~5 land at the same time — verified by testing
// concurrency levels directly against it. 3 stayed reliably under that limit,
// so a whole fleet's worth of per-vehicle stats is fetched in small batches
// rather than all at once.
const TODAY_STATS_CONCURRENCY = 3;

/** Today's stats for many units at once, batched to stay under the server's concurrency limit. */
export async function getWialonTodayStatsForUnits(
  units: { vehicleId: string; unitId: number }[]
): Promise<Map<string, { kmToday: number; maxSpeedKmh: number }>> {
  const result = new Map<string, { kmToday: number; maxSpeedKmh: number }>();
  for (let i = 0; i < units.length; i += TODAY_STATS_CONCURRENCY) {
    const batch = units.slice(i, i + TODAY_STATS_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ vehicleId, unitId }) => {
        try {
          result.set(vehicleId, await getWialonTodayStats(unitId));
        } catch (err) {
          console.error(`Wialon bugungi статистика xato (unit ${unitId}):`, err);
        }
      })
    );
  }
  return result;
}
