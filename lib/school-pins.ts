import type { House, School, SchoolLevel, SchoolPin } from "./types";

const LEVELS: SchoolLevel[] = ["elementary", "middle", "high"];

function schoolPinId(level: SchoolLevel, name: string) {
  const key = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(elementary|middle|high|school)+$/g, "");
  return `${level}:${key}`;
}

function realSchoolPoint(school?: School | null) {
  const lat = Number(school?.lat);
  const lng = Number(school?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

export function listedSchools(houses?: House[] | null): SchoolPin[] {
  const byId = new Map<string, SchoolPin>();
  for (const house of houses || []) {
    for (const level of LEVELS) {
      const school = house?.schools?.[level];
      const name = String(school?.name || "").trim();
      if (!name) continue;
      const id = schoolPinId(level, name);
      const prev = byId.get(id);
      if (realSchoolPoint(school)) {
        byId.set(id, { id, name, level, lat: Number(school.lat), lng: Number(school.lng) });
      } else if (!prev) {
        byId.set(id, { id, name, level, lat: null, lng: null });
      }
    }
  }
  return [...byId.values()];
}

export function assignedSchoolPins(house?: House | null) {
  return listedSchools(house ? [house] : []).filter((school) => school.lat != null && school.lng != null);
}
