import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "board_session";
export const ACCESS_COOKIE = "access_key_id";
export const BOARD_COOKIE = "board_id";

function secret() {
  return env.SESSION_SECRET || "";
}

export function sessionToken(accessKeyId: string) {
  return createHmac("sha256", secret() || "unset").update(`access-session-v1:${accessKeyId}`).digest("hex");
}

export function readCookie(request: Request | undefined, name: string) {
  const header = request?.headers.get("cookie") || "";
  const match = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

/** True when cookies prove unlock for the access_key_id cookie. */
export function hasSession(request?: Request, accessKeyId?: string) {
  if (!secret()) return false;
  const id = accessKeyId || readCookie(request, ACCESS_COOKIE);
  if (!id) return false;
  const token = readCookie(request, SESSION_COOKIE);
  const expected = sessionToken(id);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionCookieHeader(accessKeyId: string) {
  return `${SESSION_COOKIE}=${sessionToken(accessKeyId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function accessCookieHeader(accessKeyId: string) {
  return `${ACCESS_COOKIE}=${encodeURIComponent(accessKeyId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`;
}

export function clearAccessCookieHeader() {
  return `${ACCESS_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function boardCookieHeader(boardId: string) {
  return `${BOARD_COOKIE}=${encodeURIComponent(boardId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`;
}

export function clearBoardCookieHeader() {
  return `${BOARD_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
