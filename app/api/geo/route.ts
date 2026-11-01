import { distancesFrom, driveMatrix, geocodeAddress } from "@/lib/geo";
import { countiesByGeoid, pointInCounties } from "@/lib/layers/counties";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

function points(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const lat = Number(item?.lat);
    const lng = Number(item?.lng);
    return {
      id: String(item?.id ?? ""),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

async function areaLimit(request: Request) {
  const { board, store } = await boardContext(request);
  if (board.locked) return null;
  const saved = await store.areas.list(board.id);
  const counties = saved.length ? await countiesByGeoid(saved.map((area) => area.geoid)) : [];
  if (counties.length) return (lat: number, lng: number) => pointInCounties(lat, lng, counties);
  return () => true;
}

export async function POST(request: Request) {
  const body = await request.json();

  if (Array.isArray(body.origins)) {
    const { board } = await boardContext(request);
    if (board.locked) return Response.json({ results: [] });
    const results = await driveMatrix(points(body.origins), points(body.destinations));
    return Response.json({ results });
  }

  const limit = await areaLimit(request);

  if ((body.address || Array.isArray(body.address)) && !body.destinations) {
    const point = await geocodeAddress(body.address, limit);
    if (!point) return Response.json({ error: "Could not locate that address" }, { status: 404 });
    return Response.json(point);
  }

  if (body.origin && Array.isArray(body.destinations)) {
    const origin =
      body.origin.lat != null
        ? { lat: Number(body.origin.lat), lng: Number(body.origin.lng) }
        : await geocodeAddress(body.origin.address || body.origin, limit);
    if (!origin) return Response.json({ error: "Could not locate the listing" }, { status: 404 });

    const destinations: any[] = [];
    for (const dest of body.destinations) {
      if (dest.lat != null && dest.lng != null) {
        destinations.push({ id: dest.id, lat: Number(dest.lat), lng: Number(dest.lng) });
        continue;
      }
      const point = dest.address ? await geocodeAddress(dest.address, limit) : null;
      destinations.push({ id: dest.id, ...(point || {}) });
    }

    const distances = await distancesFrom(origin, destinations);
    return Response.json({ origin, distances });
  }

  return Response.json({ error: "address or origin required" }, { status: 400 });
}
