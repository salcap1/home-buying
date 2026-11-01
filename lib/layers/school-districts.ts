import { type GeoShape } from "@/lib/layers/geometry";
import type { SchoolDistrict } from "@/lib/types";

type Point = { lat?: number | null; lng?: number | null };

const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";
/** Unified, secondary, and elementary school districts, in lookup priority order. */
const LAYERS = [14, 16, 18];
const PREFIX = "sd:";

const HEADERS = {
  "User-Agent": "home-buying/1.0 (personal house search)",
  Accept: "application/json",
};

const pointCache = new Map<string, { geoid: string; name: string } | null>();
const shapeCache = new Map<string, SchoolDistrict>();

export function isSchoolDistrictId(geoid?: string | null) {
  return String(geoid || "").startsWith(PREFIX);
}

function censusId(geoid: string) {
  return geoid.slice(PREFIX.length).replace(/\D/g, "");
}

async function queryLayer(layer: number, params: Record<string, string>) {
  const url = new URL(`${TIGER}/${layer}/query`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    features?: {
      attributes?: Record<string, unknown>;
      properties?: Record<string, unknown>;
      geometry?: GeoShape | null;
    }[];
  };
  return data.features || [];
}

export async function lookupSchoolDistrict({ lat, lng }: Point = {}) {
  const y = Number(lat);
  const x = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const key = `${x.toFixed(5)},${y.toFixed(5)}`;
  if (pointCache.has(key)) return pointCache.get(key) || null;
  for (const layer of LAYERS) {
    const features = await queryLayer(layer, {
      geometry: `${x},${y}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "GEOID,NAME",
      returnGeometry: "false",
      f: "json",
    }).catch(() => []);
    const hit = features.find((feature) => feature.attributes?.GEOID && feature.attributes?.NAME);
    if (!hit) continue;
    const found = {
      geoid: `${PREFIX}${String(hit.attributes?.GEOID).replace(/\D/g, "")}`,
      name: String(hit.attributes?.NAME).trim(),
    };
    pointCache.set(key, found);
    return found;
  }
  pointCache.set(key, null);
  return null;
}

export async function schoolDistrictShapes(geoids: Array<string | null | undefined>) {
  const wanted = [...new Set(geoids.filter(isSchoolDistrictId) as string[])];
  const missing = wanted.filter((geoid) => !shapeCache.has(geoid) && censusId(geoid));
  if (missing.length) {
    const where = `GEOID IN (${missing.map((geoid) => `'${censusId(geoid)}'`).join(",")})`;
    const batches = await Promise.all(
      LAYERS.map((layer) =>
        queryLayer(layer, {
          where,
          outFields: "GEOID,NAME",
          returnGeometry: "true",
          outSR: "4326",
          maxAllowableOffset: "0.0005",
          f: "geojson",
        }).catch(() => [])
      )
    );
    for (const feature of batches.flat()) {
      const id = String(feature.properties?.GEOID || "").replace(/\D/g, "");
      if (!id || !feature.geometry) continue;
      const geoid = `${PREFIX}${id}`;
      if (shapeCache.has(geoid)) continue;
      shapeCache.set(geoid, {
        geoid,
        name: String(feature.properties?.NAME || "").trim(),
        geometry: feature.geometry,
      });
    }
  }
  return wanted.map((geoid) => shapeCache.get(geoid)).filter(Boolean) as SchoolDistrict[];
}
