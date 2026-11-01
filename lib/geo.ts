import { lookupSchoolDistrict } from "./layers/school-districts";
import { inCircle, type SearchCircle } from "./search-area";
import type { DriveTime, SchoolLevel } from "./types";

type LatLng = { lat: number; lng: number };
type Coord = { lat?: number | null; lng?: number | null };
type NominatimHit = {
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  display_name?: string;
};
type SchoolGeocodeOpts = {
  level?: SchoolLevel;
  address?: string | null;
  near?: Coord | null;
};

const HEADERS = {
  "User-Agent": "home-buying/1.0 (personal house search)",
  Accept: "application/json",
};

/** Demo-board bbox (Charlotte metro). Future markets should come from board/layer config. */
export function inSearchArea(lat: unknown, lng: unknown) {
  const y = Number(lat);
  const x = Number(lng);
  return y > 34.7 && y < 35.5 && x > -81.35 && x < -80.5;
}

function skipGeocodeQuery(query: string) {
  return /^house\s+\d+$/i.test(String(query || "").trim());
}

export function haversineMiles(a?: Coord | null, b?: Coord | null) {
  if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
  const toRad = (n: number) => (Number(n) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

function expandAddress(query?: string | null) {
  const text = String(query || "").trim();
  if (!text) return [];
  const expanded = text
    .replace(/\bSC-(\d+)\b/gi, "Highway $1")
    .replace(/\bNC-(\d+)\b/gi, "Highway $1")
    .replace(/\bUS-(\d+)\b/gi, "US Highway $1");
  return expanded === text ? [text] : [text, expanded];
}

function cityState(address?: string | null) {
  const match = String(address || "").match(/,\s*([^,]+),\s*([A-Z]{2})\b/i);
  return {
    city: match?.[1]?.trim() || "",
    state: match?.[2]?.toUpperCase() || "",
  };
}

function campusKey(name?: string | null) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(elementary|middle|high|school)+$/g, "");
}

const KNOWN_CAMPUSES: Record<string, Partial<Record<SchoolLevel, LatLng>>> = {
  ardreykell: { high: { lat: 35.0297786, lng: -80.8273443 } },
  ballantyneridge: { high: { lat: 35.0718661, lng: -80.8384453 } },
  cuthbertson: {
    high: { lat: 34.9759775, lng: -80.7391772 },
    middle: { lat: 34.9736618, lng: -80.7419797 },
  },
  kensington: { elementary: { lat: 34.9460374, lng: -80.7754533 } },
  flinthill: {
    elementary: { lat: 35.0696041, lng: -80.9350798 },
    middle: { lat: 35.0696041, lng: -80.9350798 },
  },
  reafarmssteam: { middle: { lat: 35.053976, lng: -80.777906 } },
};

export function knownSchoolPoint(name?: string | null, level?: SchoolLevel) {
  if (!level) return null;
  return KNOWN_CAMPUSES[campusKey(name)]?.[level] || null;
}

function schoolSearchQuery(name: string, level?: SchoolLevel, address?: string | null) {
  const titled = /elementary|middle|high|school/i.test(name)
    ? name
    : `${name} ${level === "high" ? "High" : level === "middle" ? "Middle" : "Elementary"} School`;
  const { city, state } = cityState(address);
  const place = [city, state].filter(Boolean).join(", ");
  return place ? `${titled}, ${place}` : titled;
}

async function nominatimSchool(query: string, near?: Coord | null) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) return null;
  const matches = ((await response.json()) as NominatimHit[]) || [];
  let best: LatLng | null = null;
  let bestScore = -1;
  for (const match of matches) {
    const lat = Number(match.lat);
    const lng = Number(match.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) continue;
    const miles = near?.lat != null ? haversineMiles(near, { lat, lng }) : 0;
    if (miles != null && miles > 22) continue;
    const schoolish = /school/i.test(`${match.type} ${match.class} ${match.display_name}`);
    const score = (schoolish ? 100 : 0) - (miles || 0);
    if (score > bestScore) {
      best = { lat, lng };
      bestScore = score;
    }
  }
  return best;
}

export async function geocodeSchool(
  name: string,
  { level, address, near }: SchoolGeocodeOpts = {}
) {
  const known = knownSchoolPoint(name, level);
  if (known) return known;
  const query = schoolSearchQuery(name, level, address);
  if (!query) return null;
  try {
    return (await nominatimSchool(query, near)) || (await nominatimSchool(name, near));
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  address?: string | string[] | null,
  limit?: SearchCircle | ((lat: number, lng: number) => boolean) | null
) {
  const queries = [
    ...new Set((Array.isArray(address) ? address : [address]).flatMap(expandAddress)),
  ];
  if (!queries.length) return null;
  const inside = (lat: number, lng: number) => {
    if (typeof limit === "function") return limit(lat, lng);
    if (limit) return inCircle(lat, lng, limit);
    return inSearchArea(lat, lng);
  };

  for (const query of queries) {
    if (skipGeocodeQuery(query)) continue;
    const census = /\d/.test(query) ? await geocodeCensus(query) : null;
    if (census && inside(census.lat, census.lng)) return census;
    const named = await geocodeNominatim(query);
    if (named && inside(named.lat, named.lng)) return named;
  }
  return null;
}

async function geocodeCensus(address: string) {
  try {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("format", "json");
    url.searchParams.set("layers", "all");
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] };
    };
    const match = data?.result?.addressMatches?.[0];
    if (!match?.coordinates) return null;
    const lat = Number(match.coordinates.y);
    const lng = Number(match.coordinates.x);
    const district = await lookupSchoolDistrict({ lat, lng });
    return {
      lat,
      lng,
      district: district?.name || "",
      districtGeoid: district?.geoid || "",
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(address: string) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return null;
    const [match] = ((await response.json()) as NominatimHit[]) || [];
    if (!match) return null;
    const lat = Number(match.lat);
    const lng = Number(match.lon);
    const district = await lookupSchoolDistrict({ lat, lng });
    return { lat, lng, district: district?.name || "", districtGeoid: district?.geoid || "" };
  } catch {
    return null;
  }
}

const OSRM = "https://router.project-osrm.org";
/** Public table service rejects requests over this many coordinates. */
const TABLE_COORD_LIMIT = 100;
const ROUTE_CONCURRENCY = 4;

type GeoPoint = { id: string; lat?: number | null; lng?: number | null };
type Located = { id: string; lat: number; lng: number };
type TableMatrix = {
  durations: Array<Array<number | null>>;
  distances: Array<Array<number | null>>;
};

function locatedPoint(point: GeoPoint): Located | null {
  if (point.lat == null || point.lng == null) return null;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { id: point.id, lat, lng };
}

function driveLeg(meters: number, seconds: number): DriveTime {
  return {
    miles: Math.round((meters / 1609.344) * 10) / 10,
    minutes: Math.round(seconds / 60),
    mode: "drive",
  };
}

function straightLeg(origin: Coord, destination: Coord): DriveTime {
  const miles = haversineMiles(origin, destination);
  return { miles, minutes: null, mode: miles == null ? undefined : "straight" };
}

function blankLeg(id: string): DriveTime {
  return { id, miles: null, minutes: null };
}

export async function driveDistance(origin?: Coord | null, destination?: Coord | null) {
  if (
    !origin ||
    !destination ||
    origin.lat == null ||
    origin.lng == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    return null;
  }
  try {
    const path = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const response = await fetch(`${OSRM}/route/v1/driving/${path}?overview=false`, {
      headers: HEADERS,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { routes?: { distance: number; duration: number }[] };
    const route = data?.routes?.[0];
    if (!route) return null;
    return driveLeg(route.distance, route.duration);
  } catch {
    return null;
  }
}

async function osrmTable(origins: Located[], destinations: Located[]): Promise<TableMatrix | null> {
  try {
    const coords = [...origins, ...destinations]
      .map((point) => `${point.lng},${point.lat}`)
      .join(";");
    const sources = origins.map((_, index) => index).join(";");
    const dests = destinations.map((_, index) => index + origins.length).join(";");
    const response = await fetch(
      `${OSRM}/table/v1/driving/${coords}?sources=${sources}&destinations=${dests}&annotations=duration,distance`,
      { headers: HEADERS }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code?: string;
      durations?: Array<Array<number | null>>;
      distances?: Array<Array<number | null>>;
    };
    if (data.code !== "Ok" || !data.durations || !data.distances) return null;
    return { durations: data.durations, distances: data.distances };
  } catch {
    return null;
  }
}

async function mapPool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      await run(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

function writeLeg(slot: DriveTime, leg: DriveTime) {
  slot.miles = leg.miles;
  slot.minutes = leg.minutes;
  slot.mode = leg.mode;
}

async function fillChunk(
  slots: Map<string, DriveTime[]>,
  origins: Located[],
  destinations: Located[],
  table: TableMatrix | null
) {
  if (!table) {
    const pairs = origins.flatMap((origin) =>
      destinations.map((destination) => ({ origin, destination }))
    );
    await mapPool(pairs, ROUTE_CONCURRENCY, async ({ origin, destination }) => {
      const row = slots.get(origin.id);
      const slot = row?.find((item) => item.id === destination.id);
      if (!slot) return;
      const drive = await driveDistance(origin, destination);
      writeLeg(slot, drive || straightLeg(origin, destination));
    });
    return;
  }

  origins.forEach((origin, row) => {
    const legs = slots.get(origin.id);
    destinations.forEach((destination, column) => {
      const slot = legs?.find((item) => item.id === destination.id);
      if (!slot) return;
      const meters = table.distances[row]?.[column];
      const seconds = table.durations[row]?.[column];
      if (meters == null || seconds == null) {
        writeLeg(slot, straightLeg(origin, destination));
        return;
      }
      const leg = driveLeg(meters, seconds);
      writeLeg(slot, { id: destination.id, ...leg });
    });
  });
}

/** One OSRM table call (chunked) for many listings to the same places. */
export async function driveMatrix(origins: GeoPoint[], destinations: GeoPoint[]) {
  const originList = origins.map((point, index) => ({ ...point, id: point.id || String(index) }));
  const destinationList = destinations.map((point, index) => ({
    ...point,
    id: point.id || String(index),
  }));
  const locatedOrigins = originList.flatMap((point) => {
    const located = locatedPoint(point);
    return located ? [located] : [];
  });
  const locatedDestinations = destinationList.flatMap((point) => {
    const located = locatedPoint(point);
    return located ? [located] : [];
  });
  const slots = new Map<string, DriveTime[]>(
    originList.map((origin) => [
      origin.id,
      destinationList.map((destination) => blankLeg(destination.id)),
    ])
  );

  const chunkSize = Math.max(1, TABLE_COORD_LIMIT - locatedDestinations.length);
  for (let start = 0; start < locatedOrigins.length; start += chunkSize) {
    const chunk = locatedOrigins.slice(start, start + chunkSize);
    const table = locatedDestinations.length ? await osrmTable(chunk, locatedDestinations) : null;
    if (locatedDestinations.length) await fillChunk(slots, chunk, locatedDestinations, table);
  }

  return originList.map((origin) => ({ id: origin.id, distances: slots.get(origin.id) || [] }));
}

export async function distancesFrom(origin: Coord, destinations: GeoPoint[]): Promise<DriveTime[]> {
  if (origin.lat == null || origin.lng == null) {
    return destinations.map((place) => blankLeg(place.id));
  }
  const [row] = await driveMatrix([{ id: "_", lat: origin.lat, lng: origin.lng }], destinations);
  return row?.distances || destinations.map((place) => blankLeg(place.id));
}
