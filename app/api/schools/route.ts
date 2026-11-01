import { findSchools, pullListing } from "@/lib/listing";
import { decorateSchools } from "@/lib/schools";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { address, url, schools: existing } = await request.json();
  if (!address && !url && !existing) return Response.json({ error: "Address required" }, { status: 400 });

  if (existing?.elementary?.name || existing?.middle?.name || existing?.high?.name) {
    return Response.json(await decorateSchools(existing, address || ""));
  }

  let schools: any = null;
  if (url) {
    const listing = await pullListing(url, { addressHint: address });
    schools = listing.schools;
  }
  if (!schools?.elementary && !schools?.middle && !schools?.high && address) {
    schools = await findSchools(address);
  }
  if (!schools) return Response.json({ error: "Could not find assigned schools" }, { status: 404 });
  return Response.json(schools);
}
