import {
  ACCESS_COOKIE,
  BOARD_COOKIE,
  SESSION_COOKIE,
  accessCookieHeader,
  boardCookieHeader,
  clearAccessCookieHeader,
  clearBoardCookieHeader,
  clearSessionCookieHeader,
  hasSession,
  readCookie,
  sessionCookieHeader,
  sessionToken,
} from "@/lib/auth/session";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_SECRET: "test-session-secret",
  },
}));

function requestWithCookies(cookie: string) {
  return new Request("http://localhost", { headers: { cookie } });
}

describe("readCookie", () => {
  it("returns an empty string when the cookie is missing", () => {
    expect(readCookie(requestWithCookies("other=1"), ACCESS_COOKIE)).toBe("");
    expect(readCookie(undefined, ACCESS_COOKIE)).toBe("");
  });

  it("decodes a matching cookie value", () => {
    const request = requestWithCookies(`${ACCESS_COOKIE}=${encodeURIComponent("access-1")}; path=/`);
    expect(readCookie(request, ACCESS_COOKIE)).toBe("access-1");
  });
});

describe("hasSession", () => {
  it("rejects when the session cookie is missing or forged", () => {
    expect(hasSession(requestWithCookies(`${ACCESS_COOKIE}=access-1`))).toBe(false);
    expect(
      hasSession(
        requestWithCookies(`${ACCESS_COOKIE}=access-1; ${SESSION_COOKIE}=not-a-real-token`)
      )
    ).toBe(false);
  });

  it("rejects a valid token for a different access key", () => {
    const request = requestWithCookies(
      `${ACCESS_COOKIE}=access-1; ${SESSION_COOKIE}=${sessionToken("other")}`
    );
    expect(hasSession(request)).toBe(false);
  });

  it("accepts a matching HMAC session cookie", () => {
    const request = requestWithCookies(
      `${ACCESS_COOKIE}=access-1; ${SESSION_COOKIE}=${sessionToken("access-1")}`
    );
    expect(hasSession(request)).toBe(true);
    expect(hasSession(request, "access-1")).toBe(true);
  });
});

describe("cookie headers", () => {
  it("sets HttpOnly session, access, and board cookies", () => {
    expect(sessionCookieHeader("access-1")).toContain(`${SESSION_COOKIE}=${sessionToken("access-1")}`);
    expect(sessionCookieHeader("access-1")).toContain("HttpOnly");
    expect(accessCookieHeader("access-1")).toContain(`${ACCESS_COOKIE}=access-1`);
    expect(boardCookieHeader("board-a")).toContain(`${BOARD_COOKIE}=board-a`);
  });

  it("clears cookies with Max-Age=0", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
    expect(clearAccessCookieHeader()).toContain("Max-Age=0");
    expect(clearBoardCookieHeader()).toContain("Max-Age=0");
  });
});
