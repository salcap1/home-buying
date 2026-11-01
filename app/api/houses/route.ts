import { defaultDown } from "@/lib/calc";
import { DEFAULT_DOWN, dataErrorResponse } from "@/lib/data";
import { findDismissed, listingLabel } from "@/lib/redfin-csv";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { store } = await boardContext(request);
    return Response.json(await store.houses.list());
  } catch (error) {
    return dataErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { store } = await boardContext(request);
    const dismissed = findDismissed(body, await store.dismissed.listKeys());
    if (dismissed && !body.restore) {
      const name = listingLabel({ name: body.name || dismissed.name, url: body.url });
      return Response.json(
        { error: `You already added ${name} and then deleted it.`, reason: "dismissed", name },
        { status: 409 }
      );
    }
    if (dismissed) await store.dismissed.forget(body);
    const assumptions = await store.assumptions.get();
    const down =
      body.downDollars == null || body.downDollars === ""
        ? defaultDown(body.price || 0, assumptions, body.updateCash || 0)
        : Number(body.downDollars) || 0;
    return Response.json(await store.houses.create(body, down || DEFAULT_DOWN));
  } catch (error) {
    return dataErrorResponse(error);
  }
}
