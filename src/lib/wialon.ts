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
    // Session likely expired — retry once with a fresh login.
    const freshSid = await login();
    return call<T>(svc, params, freshSid);
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
 * appear verbatim inside them, so a substring check is enough.
 */
export function matchVehiclesToWialonUnits(
  vehicles: { id: string; plate: string }[],
  units: WialonUnit[]
): Map<string, WialonUnit> {
  const map = new Map<string, WialonUnit>();
  for (const vehicle of vehicles) {
    const unit = units.find((u) => u.name.includes(vehicle.plate));
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

/** Sums a unit's GPS track between two instants into a driven-distance estimate. */
export async function getWialonMileageForRange(unitId: number, from: Date, to: Date): Promise<number> {
  const data = await callAuthed<{ messages?: { pos?: { y: number; x: number } }[] }>("messages/load_interval", {
    itemId: unitId,
    timeFrom: Math.floor(from.getTime() / 1000),
    timeTo: Math.floor(to.getTime() / 1000),
    flags: 0,
    flagsMask: 0,
    loadCount: 20000,
  });

  const points = (data.messages ?? [])
    .map((m) => m.pos)
    .filter((p): p is { y: number; x: number } => !!p)
    .map((p) => ({ lat: p.y, lon: p.x }));

  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
}

/** Sums today's GPS track (midnight so far) into a driven-distance estimate. */
export async function getWialonMileageToday(unitId: number): Promise<number> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return getWialonMileageForRange(unitId, from, now);
}
