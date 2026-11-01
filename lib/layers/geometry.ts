type Ring = number[][];

export type GeoShape =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export type GeoBounds = { xmin: number; ymin: number; xmax: number; ymax: number };

function pointInRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const crosses = y1 > lat !== y2 > lat;
    if (crosses && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1 || Number.EPSILON) + x1) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInGeometry(lng: number, lat: number, geometry?: GeoShape | null) {
  if (geometry?.type === "Polygon") {
    return geometry.coordinates.some((ring) => pointInRing(lng, lat, ring));
  }
  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => polygon.some((ring) => pointInRing(lng, lat, ring)));
  }
  return false;
}

function polygonsOf(geometry: GeoShape) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

export function samplePoints(geometry?: GeoShape | null, limit = 12): [number, number][] {
  if (!geometry || limit < 1) return [];
  const points: [number, number][] = [];
  for (const polygon of polygonsOf(geometry)) {
    for (const ring of polygon) {
      if (!ring?.length) continue;
      const step = Math.max(1, Math.floor(ring.length / limit));
      for (let index = 0; index < ring.length && points.length < limit; index += step) {
        const pair = ring[index];
        if (pair && pair.length >= 2) points.push([pair[0], pair[1]]);
      }
    }
    if (points.length >= limit) break;
  }
  return points;
}

export function boundsOf(geometries: Array<GeoShape | null | undefined>): GeoBounds | null {
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;
  for (const geometry of geometries) {
    if (!geometry) continue;
    for (const polygon of polygonsOf(geometry)) {
      for (const ring of polygon) {
        for (const pair of ring) {
          if (!pair || pair.length < 2) continue;
          xmin = Math.min(xmin, pair[0]);
          ymin = Math.min(ymin, pair[1]);
          xmax = Math.max(xmax, pair[0]);
          ymax = Math.max(ymax, pair[1]);
        }
      }
    }
  }
  if (!Number.isFinite(xmin)) return null;
  return { xmin, ymin, xmax, ymax };
}

export function shapesTouch(left?: GeoShape | null, right?: GeoShape | null) {
  if (!left || !right) return false;
  if (samplePoints(left, 16).some(([lng, lat]) => pointInGeometry(lng, lat, right))) return true;
  return samplePoints(right, 16).some(([lng, lat]) => pointInGeometry(lng, lat, left));
}
