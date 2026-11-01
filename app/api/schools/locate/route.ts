import { locateHouseSchools } from "@/lib/schools";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { board, store } = await boardContext(request);
    if (board.locked) return Response.json({ error: "Unlock the board first" }, { status: 401 });
    return Response.json(await locateHouseSchools(4, store));
  } catch (error: any) {
    return Response.json({ error: error.message || "Could not locate schools" }, { status: 502 });
  }
}
