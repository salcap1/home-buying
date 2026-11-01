import { pointInGeometry, type GeoShape } from "@/lib/layers/geometry";

export type CountyArea = {
  geoid: string;
  name: string;
  state: string;
  geometry: GeoShape;
};

const LAYER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/82";

const HEADERS = {
  "User-Agent": "home-buying/1.0 (personal house search)",
  Accept: "application/json",
};

const STATE_ABBR: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "72": "PR",
};

type CountyFeature = {
  properties?: { GEOID?: string; NAME?: string; STATE?: string };
  geometry?: GeoShape | null;
};

function placeName(name: string) {
  return name.replace(/\bcity$/, "City");
}

function asCounty(feature: CountyFeature): CountyArea | null {
  const geoid = String(feature.properties?.GEOID || "").replace(/\D/g, "");
  const name = placeName(String(feature.properties?.NAME || "").trim());
  const geometry = feature.geometry;
  if (!geoid || !name || !geometry) return null;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  return {
    geoid,
    name,
    state: STATE_ABBR[String(feature.properties?.STATE || "")] || "",
    geometry,
  };
}

async function queryCounties(params: Record<string, string>) {
  const url = new URL(`${LAYER}/query`);
  url.searchParams.set("outFields", "GEOID,NAME,STATE");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("maxAllowableOffset", "0.003");
  url.searchParams.set("f", "geojson");
  if (params.geometry) {
    url.searchParams.set("geometryType", "esriGeometryEnvelope");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) return [] as CountyArea[];
  const data = (await response.json()) as { features?: CountyFeature[] };
  const counties = new Map<string, CountyArea>();
  for (const feature of data.features || []) {
    const county = asCounty(feature);
    if (county) counties.set(county.geoid, county);
  }
  return [...counties.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function countyLabel(county: { name: string; state?: string }) {
  return county.state ? `${county.name}, ${county.state}` : county.name;
}

export function pointInCounties(
  lat: unknown,
  lng: unknown,
  counties: { geometry?: GeoShape | null }[]
) {
  const y = Number(lat);
  const x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return false;
  return counties.some((county) => county.geometry && pointInGeometry(x, y, county.geometry));
}

export async function countiesByGeoid(geoids: string[]) {
  const ids = [...new Set(geoids.map((geoid) => geoid.replace(/\D/g, "")).filter((geoid) => geoid.length === 5))];
  if (!ids.length) return [] as CountyArea[];
  return queryCounties({ where: `GEOID IN (${ids.map((id) => `'${id}'`).join(",")})` });
}

export async function searchCounties(query: string) {
  const text = query.replace(/[^a-zA-Z .'-]/g, "").trim();
  if (text.length < 2) return [] as CountyArea[];
  const safe = text.toUpperCase().replace(/'/g, "''");
  return queryCounties({
    where: `UPPER(NAME) LIKE '${safe}%'`,
    resultRecordCount: "8",
  });
}
