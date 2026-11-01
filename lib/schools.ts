// GreatSchools + Nominatim enrichment. Ratings go through getStore(); METRO/NAME_ALIASES stay demo-board data until a layer catalog exists.
import { getStore, type SchoolRating } from "./data";
import { geocodeSchool, knownSchoolPoint } from "./geo";
import type { House, School, SchoolLevel, Schools } from "./types";
import { EMPTY_SCHOOL } from "./types";

type LatLng = { lat: number; lng: number };
type Coord = { lat?: number | null; lng?: number | null };
type SchoolInput = Omit<Partial<School>, "rating"> & { name?: string; rating?: number | string | null };
type GsSchool = {
  name?: string;
  rating?: number;
  schoolType?: string;
  levelCode?: string;
  gradeLevels?: string;
  lat?: number;
  latitude?: number;
  lon?: number;
  lng?: number;
  longitude?: number;
  address?: { city?: string };
  districtCity?: string;
  links?: { profile?: string };
};
type RatedSchool = Pick<School, "name" | "rating" | "source" | "url"> & {
  lat?: number | null;
  lng?: number | null;
};

const LEVELS: SchoolLevel[] = ["elementary", "middle", "high"];

function cityState(address?: string | null) {
  const match = String(address || "").match(/,\s*([^,]+),\s*([A-Z]{2})\b/i);
  return {
    city: match?.[1]?.trim() || "",
    state: match?.[2]?.toUpperCase() || "",
  };
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const LEVEL_CODE: Record<SchoolLevel, string> = { elementary: "e", middle: "m", high: "h" };
const LEVEL_WORD: Record<SchoolLevel, string> = { elementary: "Elementary", middle: "Middle", high: "High" };
const JUNK_SCHOOL =
  /^(within walking|walking distance|unspecified|in [a-z])|^\d|boulevard|u\.?s\.?\s*\d|community house road/i;
const METRO = [
  ["fortmill", "tegacay", "rockhill", "indianland"],
  ["charlotte", "pineville", "matthews", "minthill"],
  ["indiantrail", "stallings", "monroe", "waxhaw", "wesleychapel", "marvin", "weddington", "matthews", "charlotte"],
  ["belmont", "gastonia", "cramerton", "mountholly"],
  ["concord", "kannapolis", "harrisburg"],
  ["cornelius", "huntersville", "davidson"],
];
const NAME_ALIASES = [{ from: /^bridgecreek$/, near: ["fortmill", "tegacay"], to: "Dobys Bridge" }];

export function schoolName(value?: School | string | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || "";
}

function asCoord(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function bogusZeroPoint(value?: { lat?: unknown; lng?: unknown } | null) {
  return value?.lat === 0 || value?.lat === "0" || value?.lng === 0 || value?.lng === "0";
}

export function asSchool(value?: SchoolInput | string | null): School {
  if (!value) return { ...EMPTY_SCHOOL };
  if (typeof value === "string") return { ...EMPTY_SCHOOL, name: value };
  const lat = asCoord(value.lat);
  const lng = asCoord(value.lng);
  return {
    name: value.name || "",
    rating: value.rating == null || value.rating === "" ? null : Number(value.rating),
    source: value.source || "",
    url: value.url || "",
    lat,
    lng,
    geoTried: Boolean(value.geoTried) && !bogusZeroPoint(value),
  };
}

export function packSchools(schools?: Partial<Schools> | null): Schools {
  return {
    elementary: asSchool(schools?.elementary),
    middle: asSchool(schools?.middle),
    high: asSchool(schools?.high),
  };
}

export function schoolKey(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(elementary|middle|high|school)+$/g, "");
}

export function usableSchoolName(value?: School | string | null) {
  const name = schoolName(value).trim();
  if (!name || name.length < 3 || JUNK_SCHOOL.test(name)) return "";
  if (/^\d/.test(name)) return "";
  return name;
}

export function urlFitsLevel(url?: string | null, level?: SchoolLevel) {
  if (!url) return false;
  const path = String(url).toLowerCase();
  if (level === "high") return /high/.test(path) && !/elementary|middle/.test(path);
  if (level === "middle") return /middle/.test(path) && !/elementary/.test(path);
  if (level === "elementary") return /elementary/.test(path) || (!/middle|high/.test(path) && /greatschools/.test(path));
  return true;
}

function urlCity(url?: string | null) {
  const match = String(url || "").match(/greatschools\.org\/(?:north|south)-carolina\/([^/]+)/i);
  return schoolKey(decodeURIComponent(match?.[1] || "").replace(/-/g, " "));
}

function citiesNear(left?: string | null, right?: string | null) {
  const a = schoolKey(left);
  const b = schoolKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return METRO.some((group) => group.includes(a) && group.includes(b));
}

function ratingNearAddress(school?: Pick<School, "url"> | null, address?: string | null) {
  if (!school?.url) return true;
  const houseCity = cityState(address).city;
  const schoolCity = urlCity(school.url);
  if (!houseCity || !schoolCity) return true;
  return citiesNear(houseCity, schoolCity);
}

function ratingLooksGood(school: School, level: SchoolLevel, address?: string | null) {
  if (!school?.name || school.rating == null) return false;
  if (school.url && !urlFitsLevel(school.url, level)) return false;
  if (address && !ratingNearAddress(school, address)) return false;
  return true;
}

function aliasedName(name: string, address?: string | null) {
  const city = schoolKey(cityState(address).city);
  const key = schoolKey(name);
  for (const alias of NAME_ALIASES) {
    if (alias.from.test(key) && alias.near.includes(city)) return alias.to;
  }
  return name;
}

function schoolPlace(school?: GsSchool | null) {
  if (!school) return "";
  return school.address?.city || school.districtCity || urlCity(school.links?.profile);
}

function schoolCoords(school?: GsSchool | null) {
  if (!school) return null;
  const lat = Number(school.lat ?? school.latitude);
  const lon = Number(school.lon ?? school.lng ?? school.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lng: lon };
}

function milesApart(left?: Coord | null, right?: Coord | null) {
  if (left?.lat == null || left?.lng == null || right?.lat == null || right?.lng == null) return null;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(right.lat - left.lat);
  const dLng = toRad(right.lng - left.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(left.lat)) * Math.cos(toRad(right.lat)) * Math.sin(dLng / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function schoolIsLocal(school: GsSchool, address?: string | null, coords?: Coord | null) {
  const dist = milesApart(coords, schoolCoords(school));
  if (dist != null) return dist <= 22;
  const houseCity = cityState(address).city;
  const there = schoolPlace(school);
  if (houseCity && there) return citiesNear(houseCity, there);
  return false;
}

function fuzzyScore(query: string, schoolName?: string | null) {
  const exact = nameScore(query, schoolName);
  if (exact) return exact;
  const left = coreTokens(query);
  const right = coreTokens(schoolName);
  if (!left.length || !right.length) return 0;
  const overlap = left.filter((token) => right.includes(token));
  if (!overlap.length) return 0;
  return 40 + overlap.length * 18;
}

function extractJsonObject(text: string) {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(0, i + 1);
    }
  }
  throw new Error("unclosed");
}

function parseSearchSchools(html: string): GsSchool[] {
  const mark = "gon.search=";
  const start = html.indexOf(mark);
  if (start < 0) return [];
  try {
    const data = JSON.parse(extractJsonObject(html.slice(start + mark.length))) as { schools?: GsSchool[] };
    return Array.isArray(data.schools) ? data.schools : [];
  } catch {
    return [];
  }
}

function levelMatches(school: GsSchool, level: SchoolLevel) {
  const code = LEVEL_CODE[level];
  const codes = String(school.levelCode || "").split(",").map((item) => item.trim());
  if (code && codes.includes(code)) return true;
  const grades = String(school.gradeLevels || "");
  if (level === "high") return /9\s*-\s*12/.test(grades);
  if (level === "middle") return /6\s*-\s*8|7\s*-\s*8/.test(grades);
  if (level === "elementary") return /(K|PK|1)\s*-?\s*5/.test(grades) && !/9\s*-\s*12|6\s*-\s*8/.test(grades);
  return false;
}

function nameScore(query: string, schoolName?: string | null) {
  const q = schoolKey(query);
  const n = schoolKey(schoolName);
  if (!q || !n || q.length < 3) return 0;
  if (q === n) return 100;
  if (n.startsWith(q) || q.startsWith(n)) return 82;
  if (n.includes(q) || q.includes(n)) {
    return Math.round((Math.min(q.length, n.length) / Math.max(q.length, n.length)) * 70);
  }
  return 0;
}

function pickSchool(
  schools: GsSchool[],
  query: string,
  level: SchoolLevel,
  address?: string | null,
  coords?: Coord | null,
  loose = false
) {
  const cityKey = schoolKey(cityState(address).city);
  let best: GsSchool | null = null;
  let bestScore = 0;
  const min = loose ? 50 : 70;
  for (const school of schools) {
    if (!levelMatches(school, level)) continue;
    if (school.schoolType && school.schoolType !== "public") continue;
    if (school.rating == null || school.rating < 1 || school.rating > 10) continue;
    if (!schoolIsLocal(school, address, coords)) continue;
    let score = loose ? fuzzyScore(query, school.name) : nameScore(query, school.name);
    if (score < min) continue;
    if (cityKey && schoolKey(schoolPlace(school)) === cityKey) score += 12;
    if (score > bestScore) {
      best = school;
      bestScore = score;
    }
  }
  return best;
}

function asRated(school: GsSchool): RatedSchool {
  const path = school.links?.profile || "";
  const coords = schoolCoords(school);
  return {
    name: school.name || "",
    rating: Number(school.rating),
    source: "GreatSchools",
    url: path ? `https://www.greatschools.org${path}` : "",
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, { headers: HEADERS, redirect: "follow" });
    return await response.text();
  } catch {
    return "";
  }
}

function searchStates(state?: string | null) {
  const primary = state === "SC" || state === "NC" ? state : state || "NC";
  const extra = primary === "SC" ? "NC" : primary === "NC" ? "SC" : "";
  return [primary, extra].filter(Boolean);
}

function coreTokens(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !/^(elementary|middle|high|school|the)$/.test(word));
}

export function sameSchoolName(left?: string | null, right?: string | null) {
  const a = schoolKey(left);
  const b = schoolKey(right);
  if (a && b && (a === b || a.startsWith(b) || b.startsWith(a))) return true;
  const ta = coreTokens(left);
  const tb = coreTokens(right);
  if (!ta.length || !tb.length) return false;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  return ta.every((token) => tb.includes(token)) || tb.every((token) => ta.includes(token));
}

function searchQueries(name: string, level: SchoolLevel) {
  const suffix = LEVEL_WORD[level] || "";
  const stripped = name.replace(/\b[A-Za-z]\./g, " ").replace(/\s+/g, " ").trim();
  const queries: string[] = [];
  for (const item of [name, stripped].filter(Boolean)) {
    if (suffix && !new RegExp(suffix, "i").test(item)) queries.push(`${item} ${suffix} School`);
    queries.push(item);
  }
  return [...new Set(queries)];
}

export async function rateSchool(
  name: string,
  address?: string | null,
  level: SchoolLevel = "high",
  coords: Coord = {}
) {
  const queryName = usableSchoolName(aliasedName(name, address));
  if (!queryName) return null;
  const parsed = cityState(address);
  const queries = [
    ...searchQueries(queryName, level),
    parsed.city ? `${parsed.city} ${LEVEL_WORD[level] || ""} School`.trim() : "",
  ].filter(Boolean);
  for (const state of searchStates(parsed.state)) {
    for (const query of queries) {
      const html = await fetchHtml(
        `https://www.greatschools.org/search/search.page?q=${encodeURIComponent(query)}&state=${state}`
      );
      const found = parseSearchSchools(html);
      const match =
        pickSchool(found, queryName, level, address, coords) ||
        pickSchool(found, queryName, level, address, coords, true);
      if (match) return asRated(match);
    }
  }
  return null;
}

export async function cachedRating(name: string, level: SchoolLevel, state?: string | null, address?: string | null) {
  const key = schoolKey(name);
  if (!key) return null;
  const rated = await getStore().ratings.find(key, level, state || "");
  if (!rated) return null;
  if (address && !ratingNearAddress(rated, address)) return null;
  return rated;
}

export async function saveRating(name: string, level: SchoolLevel, state?: string | null, rated?: RatedSchool | SchoolRating | null) {
  if (!rated?.rating) return;
  const keys = [...new Set([schoolKey(name), schoolKey(rated.name)].filter(Boolean))];
  const store = getStore();
  for (const key of keys) {
    await store.ratings.save(key, level, state || "", {
      name: rated.name || name,
      rating: rated.rating,
      url: rated.url || "",
      source: rated.source || "GreatSchools",
    });
  }
}

function applyRated(current: School, rated: RatedSchool | SchoolRating): School {
  const keepName = sameSchoolName(current.name, rated.name) ? current.name : rated.name;
  return {
    ...current,
    ...rated,
    name: keepName || rated.name,
    lat: ("lat" in rated ? rated.lat : null) ?? current.lat ?? null,
    lng: ("lng" in rated ? rated.lng : null) ?? current.lng ?? null,
  };
}

export async function decorateSchools(
  schools?: Partial<Schools> | null,
  address?: string | null,
  coords: Coord = {}
) {
  const packed = packSchools(schools);
  const state = cityState(address).state;
  for (const level of LEVELS) {
    const rawName = packed[level].name;
    const name = usableSchoolName(aliasedName(rawName, address)) || usableSchoolName(rawName);
    if (!name) {
      if (packed[level].name && !usableSchoolName(packed[level].name)) {
        packed[level] = asSchool(null);
      }
      continue;
    }
    packed[level].name = packed[level].name || name;
    if (!ratingLooksGood(packed[level], level, address)) {
      const rated =
        (await cachedRating(name, level, state, address)) ||
        (await rateSchool(name, address, level, coords));
      if (rated) {
        packed[level] = applyRated(packed[level], rated);
        await saveRating(name, level, state, rated).catch(() => {});
      }
    }
    if (packed[level].lat == null || packed[level].lng == null) {
      const point = await geocodeSchool(name, { level, address, near: coords });
      if (point) packed[level] = { ...packed[level], lat: point.lat, lng: point.lng, geoTried: true };
    }
  }
  return packed;
}

function lookupKey(name: string, level: SchoolLevel, state?: string | null) {
  return `${schoolKey(name)}|${level}|${state || ""}`;
}

export async function refreshHouseSchools(store = getStore()) {
  const houses = await store.houses.list();
  const known = new Map<string, RatedSchool>();
  const needed: { key: string; name: string; level: SchoolLevel; state: string; address: string; coords: Coord }[] = [];

  for (const house of houses) {
    const state = cityState(house.name).state;
    const packed = packSchools(house.schools);
    for (const level of LEVELS) {
      const name = usableSchoolName(aliasedName(packed[level].name, house.name)) || usableSchoolName(packed[level].name);
      if (!name) {
        if (packed[level].name) packed[level] = asSchool(null);
        continue;
      }
      const key = lookupKey(name, level, state);
      if (ratingLooksGood(packed[level], level, house.name)) {
        known.set(key, {
          rating: packed[level].rating,
          source: packed[level].source || "GreatSchools",
          url: packed[level].url || "",
          name: packed[level].name,
        });
      } else if (!needed.some((item) => item.key === key)) {
        needed.push({
          key,
          name,
          level,
          state,
          address: house.name,
          coords: { lat: house.lat, lng: house.lng },
        });
      }
    }
    house.schools = packed;
  }

  for (const item of needed) {
    if (known.has(item.key)) continue;
    const nearby = [...known.values()].find(
      (value) => sameSchoolName(item.name, value.name)
    );
    const rated =
      nearby ||
      (await cachedRating(item.name, item.level, item.state, item.address)) ||
      (await rateSchool(item.name, item.address, item.level, item.coords));
    if (rated) {
      known.set(item.key, rated);
      await saveRating(item.name, item.level, item.state, rated).catch(() => {});
    }
  }

  const updated: House[] = [];
  for (const house of houses) {
    const state = cityState(house.name).state;
    let changed = false;
    const next = packSchools(house.schools);
    for (const level of LEVELS) {
      const name = usableSchoolName(aliasedName(next[level].name, house.name)) || usableSchoolName(next[level].name);
      if (!name) {
        if (next[level].name) {
          next[level] = asSchool(null);
          changed = true;
        }
        continue;
      }
      const rated =
        known.get(lookupKey(name, level, state)) ||
        [...known.entries()].find(([key, value]) => {
          const [, knownLevel, knownState] = key.split("|");
          return knownLevel === level && (!state || !knownState || knownState === state) && sameSchoolName(name, value.name);
        })?.[1];
      if (!rated) continue;
      const nextSchool = applyRated(next[level], rated);
      if (
        next[level].rating !== nextSchool.rating ||
        next[level].url !== nextSchool.url ||
        next[level].name !== nextSchool.name ||
        next[level].source !== nextSchool.source ||
        next[level].lat !== nextSchool.lat ||
        next[level].lng !== nextSchool.lng
      ) {
        next[level] = nextSchool;
        changed = true;
      }
    }
    if (!changed) continue;
    updated.push(await store.houses.saveSchools(house.id, next));
  }

  return {
    lookedUp: needed.length,
    filled: updated.length,
    houses: houses.map((house) => updated.find((item) => item.id === house.id) || house),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function schoolLocateKey(name: string, level: SchoolLevel) {
  return `${schoolKey(name)}|${level}`;
}

function needsSchoolPoint(school?: School | null, level?: SchoolLevel) {
  if (!school || !usableSchoolName(school)) return false;
  if (school.lat != null && school.lng != null) return false;
  if (level && knownSchoolPoint(school.name, level)) return true;
  return !school.geoTried;
}

export async function locateHouseSchools(limit = 4, store = getStore()) {
  const houses = await store.houses.list();
  const unique: {
    key: string;
    name: string;
    level: SchoolLevel;
    address: string;
    near: Coord;
  }[] = [];
  const seen = new Set<string>();
  for (const house of houses) {
    for (const level of LEVELS) {
      const school = house.schools?.[level];
      if (!school || !needsSchoolPoint(school, level)) continue;
      const name = usableSchoolName(aliasedName(school.name, house.name)) || usableSchoolName(school.name);
      const key = schoolLocateKey(name, level);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      unique.push({
        key,
        name,
        level,
        address: house.name,
        near: { lat: house.lat, lng: house.lng },
      });
    }
  }

  const batch = unique.slice(0, limit);
  const found = new Map<string, LatLng | { missed: true }>();
  for (const item of batch) {
    let point = await geocodeSchool(item.name, {
      level: item.level,
      address: item.address,
      near: item.near,
    });
    if (!point) {
      const rated = await rateSchool(item.name, item.address, item.level, item.near);
      if (rated?.lat && rated?.lng) point = { lat: rated.lat, lng: rated.lng };
    }
    found.set(item.key, point || { missed: true });
    await wait(1100);
  }

  const updated: House[] = [];
  for (const house of houses) {
    let changed = false;
    const next = packSchools(house.schools);
    for (const level of LEVELS) {
      const name = usableSchoolName(aliasedName(next[level].name, house.name)) || usableSchoolName(next[level].name);
      if (!name) continue;
      const hit =
        found.get(schoolLocateKey(name, level)) ||
        [...found.entries()].find(([key, value]) => {
          const [knownName, knownLevel] = key.split("|");
          return knownLevel === level && schoolKey(name) === knownName && value;
        })?.[1];
      if (!hit) continue;
      if ("missed" in hit) {
        if (!next[level].geoTried) {
          next[level] = { ...next[level], geoTried: true };
          changed = true;
        }
        continue;
      }
      if (next[level].lat === hit.lat && next[level].lng === hit.lng) continue;
      next[level] = { ...next[level], lat: hit.lat, lng: hit.lng, geoTried: true };
      changed = true;
    }
    if (!changed) continue;
    updated.push(await store.houses.saveSchools(house.id, next));
  }

  return {
    located: [...found.values()].filter((item) => !("missed" in item)).length,
    updated,
    remaining: Math.max(0, unique.length - batch.length),
    houses: houses.map((house) => updated.find((item) => item.id === house.id) || house),
  };
}
