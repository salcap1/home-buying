import { dataErrorResponse } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";
import { pullListing } from "@/lib/listing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { store } = await boardContext(request);
    const pending = await store.houses.listNeedingCosts();
    const updated: Awaited<ReturnType<typeof store.houses.updateCosts>>[] = [];
    for (const house of pending) {
      try {
        const listing = await pullListing(house.url, { addressHint: house.name });
        const tax = listing.taxMonthly;
        const insurance = listing.insuranceMonthly;
        if (tax == null && (insurance == null || insurance === 0)) {
          await store.houses.touch(house.id);
          continue;
        }
        const next = await store.houses.updateCosts(
          house.id,
          tax ?? house.tax_monthly,
          insurance || house.insurance_monthly || 0
        );
        if (next) updated.push(next);
      } catch {
        await store.houses.touch(house.id);
      }
    }
    return Response.json({ updated, remaining: await store.houses.countNeedingCosts() });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
