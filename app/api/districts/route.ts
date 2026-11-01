import { dataErrorResponse } from "@/lib/data";
import { isSchoolDistrictId, lookupSchoolDistrict, schoolDistrictShapes } from "@/lib/layers/school-districts";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DistrictHouse = {
  id?: string;
  lat?: number | null;
  lng?: number | null;
  district?: string;
  districtGeoid?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const houses: DistrictHouse[] = Array.isArray(body.houses) ? body.houses : [];
    const { board, store } = await boardContext(request);
    const assignments: Record<string, { geoid: string; name: string }> = {};

    await Promise.all(
      houses.map(async (house) => {
        const id = String(house.id || "");
        if (!id) return;
        if (isSchoolDistrictId(house.districtGeoid) && house.district) {
          assignments[id] = { geoid: String(house.districtGeoid), name: String(house.district) };
          return;
        }
        const found = await lookupSchoolDistrict(house);
        if (!found) return;
        assignments[id] = found;
        if (!board.locked && /^[0-9a-f-]{36}$/i.test(id)) {
          await store.houses.mergeDistrict(id, found.name, found.geoid);
        }
      })
    );

    const districts = await schoolDistrictShapes(Object.values(assignments).map((item) => item.geoid));
    return Response.json({ assignments, districts });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
