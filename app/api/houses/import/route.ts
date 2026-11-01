import { defaultDown } from "@/lib/calc";
import { DEFAULT_DOWN, dataErrorResponse } from "@/lib/data";
import { countiesByGeoid, pointInCounties } from "@/lib/layers/counties";
import { boardContext } from "@/lib/tenancy";
import {
  findDismissed,
  findExisting,
  isUnavailableListing,
  listingLabel,
  parseRedfinCsv,
  unavailableReason,
} from "@/lib/redfin-csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const { csv, restoreDismissed } = await request.json().catch(() => ({}));
  if (!csv || String(csv).length > 2_000_000) {
    return Response.json({ error: "Upload a Redfin CSV download." }, { status: 400 });
  }

  const incoming = parseRedfinCsv(csv);
  if (!incoming.length) {
    return Response.json({ error: "That file does not look like a Redfin download." }, { status: 400 });
  }

  try {
  const { store, board } = await boardContext(request);
  if (board.locked) return Response.json({ error: "Unlock the board first" }, { status: 401 });
  const savedAreas = await store.areas.list(board.id);
  const counties = savedAreas.length ? await countiesByGeoid(savedAreas.map((area) => area.geoid)) : [];
  const assumptions = await store.assumptions.get();
  const existing = await store.houses.listSummaries();
  const dismissed = await store.dismissed.listKeys();

  const created: any[] = [];
  const updated: any[] = [];
  const removed: any[] = [];
  const dismissedRows: { name: string }[] = [];
  const unavailableRows: { name: string; status: string; reason: string; removed: boolean }[] = [];
  const outsideRows: { name: string }[] = [];
  let skipped = 0;

  for (const house of incoming) {
    const name = listingLabel(house);
    const remembered = findDismissed(house, dismissed);
    if (remembered && !restoreDismissed) {
      dismissedRows.push({ name: listingLabel({ name: house.name || remembered.name, url: house.url }) });
      continue;
    }
    if (remembered) await store.dismissed.forget(house);
    if (isUnavailableListing(house.status)) {
      const match = findExisting(house, existing);
      const reason = unavailableReason(house.status);
      if (match) {
        await store.houses.remove(match.id);
        removed.push({ id: match.id, name: match.name, status: house.status });
        unavailableRows.push({ name: match.name || name, status: house.status, reason, removed: true });
        const index = existing.findIndex((item) => item.id === match.id);
        if (index >= 0) existing.splice(index, 1);
      } else {
        unavailableRows.push({ name, status: house.status, reason, removed: false });
      }
      continue;
    }
    if (counties.length && house.lat != null && house.lng != null && !pointInCounties(house.lat, house.lng, counties)) {
      outsideRows.push({ name });
      continue;
    }

    const match = findExisting(house, existing);
    if (match) {
      const nextPrice = house.price || 0;
      const currentPrice = Number(match.price) || 0;
      const community = house.facts?.community || "";
      if ((nextPrice && nextPrice !== currentPrice) || community) {
        const priceChanged = Boolean(nextPrice && nextPrice !== currentPrice);
        const price = priceChanged ? nextPrice : currentPrice;
        const down = defaultDown(price, assumptions, match.update_cash);
        const mapped = await store.houses.updateImportMatch(match.id, price, down, priceChanged, community);
        if (nextPrice && nextPrice !== currentPrice) {
          updated.push(mapped);
          match.price = nextPrice;
        } else {
          skipped += 1;
        }
      } else {
        skipped += 1;
      }
      continue;
    }

    const mapped = await store.houses.insertImported(
      house,
      defaultDown(house.price || 0, assumptions, 0) || DEFAULT_DOWN
    );
    created.push(mapped);
    existing.push({ id: mapped.id, name: mapped.name, url: mapped.url, price: mapped.price });
  }

  return Response.json({
    incoming: incoming.length,
    created,
    updated,
    removed,
    skipped,
    dismissed: dismissedRows,
    unavailable: unavailableRows,
    outside: outsideRows,
    added: created.length,
  });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
