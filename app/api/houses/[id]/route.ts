import { dataErrorResponse } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { store } = await boardContext(request);
    const house = await store.houses.update(id, body);
    if (!house) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(house);
  } catch (error) {
    return dataErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!("hearted" in body)) return Response.json({ error: "Nothing to update" }, { status: 400 });
    const { store } = await boardContext(request);
    const house = await store.houses.setHearted(id, Boolean(body.hearted));
    if (!house) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(house);
  } catch (error) {
    return dataErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { store } = await boardContext(request);
    const current = await store.houses.get(id);
    const remember = new URL(request.url).searchParams.get("remember") !== "0";
    if (current && remember) await store.dismissed.remember(current);
    await store.houses.remove(id);
    return Response.json({ ok: true });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
