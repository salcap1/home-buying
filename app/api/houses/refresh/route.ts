import { defaultDown } from "@/lib/calc";
import { dataErrorResponse } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";
import { refreshRedfinListing } from "@/lib/listing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Refresh listing prices for the signed-in board (no cron / shared secret). */
export async function GET(request: Request) {
  try {
    const { board, store } = await boardContext(request);
    if (board.locked || !board.id) {
      return new Response("Unlock required", { status: 401 });
    }

    const assumptions = await store.assumptions.get();
    const houses = await store.houses.listRefreshTargets();

    const updated: Awaited<ReturnType<typeof store.houses.updatePriceUrl>>[] = [];
    const removed: { id: string; name: string; status: string }[] = [];
    let skipped = 0;
    let failed = 0;

    for (const [index, house] of houses.entries()) {
      if (index) await sleep(400);
      try {
        const listing = await refreshRedfinListing(house);
        if (!listing.ok) {
          skipped += 1;
          continue;
        }

        if (listing.unavailable) {
          await store.houses.remove(house.id);
          removed.push({ id: house.id, name: house.name, status: listing.status });
          continue;
        }

        const nextPrice = listing.price || 0;
        const currentPrice = Number(house.price) || 0;
        const nextUrl = listing.url || house.url || "";
        const priceChanged = Boolean(nextPrice && nextPrice !== currentPrice);
        const urlChanged = Boolean(nextUrl && nextUrl !== (house.url || ""));
        if (!priceChanged && !urlChanged) {
          skipped += 1;
          continue;
        }

        const down = defaultDown(nextPrice || currentPrice, assumptions, house.update_cash);
        const row = await store.houses.updatePriceUrl(
          house.id,
          priceChanged ? nextPrice : currentPrice,
          down,
          priceChanged,
          nextUrl || house.url || null
        );
        if (priceChanged && row) updated.push(row);
        else skipped += 1;
      } catch (error: unknown) {
        failed += 1;
        console.error(`Redfin refresh failed for ${house.name}:`, error);
      }
    }

    console.log("Redfin listing refresh", {
      boardId: board.id,
      checked: houses.length,
      updated: updated.length,
      removed: removed.length,
      skipped,
      failed,
    });

    return Response.json({
      checked: houses.length,
      updated,
      removed,
      skipped,
      failed,
    });
  } catch (error) {
    return dataErrorResponse(error);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
