import {
  ACCESS_COOKIE,
  accessCookieHeader,
  boardCookieHeader,
  clearAccessCookieHeader,
  clearBoardCookieHeader,
  clearSessionCookieHeader,
  hasSession,
  readCookie,
  sessionCookieHeader,
} from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { getStore } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 8;

function jsonWithCookies(body: unknown, cookies: string[]) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { headers });
}

function catalog() {
  return getStore("charlotte");
}

function sessionPayload(accessKeyId: string, board: { id: string; name?: string }) {
  return jsonWithCookies(
    { unlocked: true, board, boardId: board.id, boards: [board] },
    [sessionCookieHeader(accessKeyId), accessCookieHeader(accessKeyId), boardCookieHeader(board.id)]
  );
}

export async function GET(request: Request) {
  const { board } = await boardContext(request);
  if (board.locked || !board.accessKeyId) {
    return Response.json({ unlocked: false, board: null, boards: [], boardId: "" });
  }
  const boards = await catalog().boards.listByAccessKey(board.accessKeyId);
  const active = boards[0];
  if (!active) {
    return Response.json({ unlocked: false, board: null, boards: [], boardId: "" });
  }
  return jsonWithCookies(
    { unlocked: true, board: active, boards: [active], boardId: active.id },
    [boardCookieHeader(active.id)]
  );
}

/** Sign in or create a password-only board (one board per password). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const mode = body.mode === "create" ? "create" : "sign_in";
  if (!password) {
    return Response.json({ error: "Password required" }, { status: 400 });
  }
  if (mode === "create" && password.length < MIN_PASSWORD) {
    return Response.json({ error: `Use at least ${MIN_PASSWORD} characters` }, { status: 400 });
  }

  const existing = await catalog().boards.unlockByPassword(password);
  if (mode === "sign_in") {
    const board = existing?.boards[0];
    if (!existing || !board) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }
    return sessionPayload(existing.accessKeyId, board);
  }

  if (existing) {
    return Response.json({ error: "That password is already in use — sign in instead" }, { status: 409 });
  }

  const created = await catalog().boards.createWorkspace(hashPassword(password));
  const board = created.boards[0];
  if (!board) {
    return Response.json({ error: "Could not create workspace" }, { status: 500 });
  }
  return sessionPayload(created.accessKeyId, board);
}

/** Rename the signed-in board. */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accessKeyId = readCookie(request, ACCESS_COOKIE);
  if (!accessKeyId || !hasSession(request, accessKeyId)) {
    return Response.json({ error: "Unlock required" }, { status: 401 });
  }

  const boards = await catalog().boards.listByAccessKey(accessKeyId);
  const board = boards[0];
  if (!board) return Response.json({ error: "Unknown search" }, { status: 404 });

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    await getStore(board.id).boards.rename(board.id, name);
    const renamed = (await catalog().boards.listByAccessKey(accessKeyId))[0];
    if (!renamed) return Response.json({ error: "Unknown search" }, { status: 404 });
    return sessionPayload(accessKeyId, renamed);
  }

  return sessionPayload(accessKeyId, board);
}

export async function DELETE() {
  return jsonWithCookies({ unlocked: false, board: null, boards: [], boardId: "" }, [
    clearSessionCookieHeader(),
    clearAccessCookieHeader(),
    clearBoardCookieHeader(),
  ]);
}
