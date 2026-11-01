import { dataErrorResponse } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = {
  "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

function photoFromHtml(html: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && /^https?:\/\//i.test(match[1])) return match[1];
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const { store } = await boardContext(request);
    const pending = await store.houses.listNeedingPhotos();
    const updated: Awaited<ReturnType<typeof store.houses.updatePhoto>>[] = [];
    for (const house of pending) {
      try {
        const response = await fetch(house.url, { headers: HEADERS, redirect: "follow" });
        const html = await response.text();
        const photo = html.length > 8000 ? photoFromHtml(html) : "";
        if (!photo) continue;
        const next = await store.houses.updatePhoto(house.id, photo);
        if (next) updated.push(next);
      } catch {
        // skip blocked or dead listings
      }
    }
    return Response.json({ updated, remaining: await store.houses.countNeedingPhotos() });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
