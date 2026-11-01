export type SearchCircle = {
  lat: number;
  lng: number;
  radiusMiles: number;
};

export function haversineMiles(
  a?: { lat?: number | null; lng?: number | null } | null,
  b?: { lat?: number | null; lng?: number | null } | null
) {
  if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
  const toRad = (n: number) => (Number(n) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function inCircle(lat: unknown, lng: unknown, circle?: SearchCircle | null) {
  if (!circle || !Number.isFinite(circle.lat) || !Number.isFinite(circle.lng)) return true;
  const miles = haversineMiles({ lat: circle.lat, lng: circle.lng }, { lat: Number(lat), lng: Number(lng) });
  return miles != null && miles <= circle.radiusMiles;
}

export function circleEnvelope(circle: SearchCircle) {
  const latPad = circle.radiusMiles / 69;
  const lngPad = circle.radiusMiles / (69 * Math.cos((circle.lat * Math.PI) / 180) || 1);
  return {
    xmin: circle.lng - lngPad,
    ymin: circle.lat - latPad,
    xmax: circle.lng + lngPad,
    ymax: circle.lat + latPad,
  };
}
