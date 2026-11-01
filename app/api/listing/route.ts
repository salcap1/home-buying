import { pullListing } from "@/lib/listing";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { url, addressHint } = await request.json();
  if (!url) return Response.json({ error: "URL required" }, { status: 400 });
  try {
    const listing = await pullListing(url, { addressHint });
    return Response.json(listing);
  } catch (error: any) {
    return Response.json({ error: error.message || "Could not read listing" }, { status: 502 });
  }
}
