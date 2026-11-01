import { dataErrorResponse, getStore } from "@/lib/data";
import { countiesByGeoid, countyLabel, searchCounties } from "@/lib/layers/counties";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

function present(
  counties: { geoid: string; name: string; state: string; geometry: unknown }[],
  selected: Set<string>
) {
  return counties.map((county) => ({
    geoid: county.geoid,
    name: countyLabel(county),
    state: county.state,
    selected: selected.has(county.geoid),
    geometry: county.geometry,
  }));
}

export async function GET(request: Request) {
  try {
    const { board, store } = await boardContext(request);
    if (board.locked) return Response.json({ counties: [] });
    const saved = await store.areas.list(board.id);
    const selected = new Set(saved.map((area) => area.geoid));
    const query = new URL(request.url).searchParams.get("q") || "";
    if (query.trim()) {
      const matches = await searchCounties(query);
      return Response.json({ counties: present(matches, selected) });
    }
    const chosen = saved.length ? await countiesByGeoid(saved.map((area) => area.geoid)) : [];
    chosen.sort((left, right) => left.name.localeCompare(right.name));
    return Response.json({ counties: present(chosen, selected) });
  } catch (error) {
    return dataErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { board, store } = await boardContext(request);
    if (board.locked) return Response.json({ error: "Unlock the board first" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const geoid = String(body.geoid || "").replace(/\D/g, "");
    const name = String(body.name || "").trim();
    if (geoid.length !== 5 || !name) return Response.json({ error: "County required" }, { status: 400 });
    await store.areas.setSelected(board.id, geoid, name, Boolean(body.selected));
    return Response.json({ ok: true });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
