describe("hasSession without SESSION_SECRET", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("never unlocks when the signing secret is missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { SESSION_SECRET: "" },
    }));
    const { hasSession, sessionToken, ACCESS_COOKIE, SESSION_COOKIE } = await import("@/lib/auth/session");
    const token = sessionToken("access-1");
    const request = new Request("http://localhost", {
      headers: {
        cookie: `${ACCESS_COOKIE}=access-1; ${SESSION_COOKIE}=${token}`,
      },
    });
    expect(hasSession(request)).toBe(false);
  });
});
