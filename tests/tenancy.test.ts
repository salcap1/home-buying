import { sessionToken } from "@/lib/auth/session";
import { resolveBoard } from "@/lib/tenancy";

const { board } = vi.hoisted(() => ({
  board: {
    id: "charlotte",
    name: "Charlotte",
    zip: "28277",
    radiusMiles: 35,
    centerLat: 35.05,
    centerLng: -80.85,
    excludeSchools: ["Blocked High"],
    rules: [{ kind: "max_housing" as const, config: { amount: 4000 } }],
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_SECRET: "test-session-secret",
    DEMO_ORG_ID: "demo",
    DATABASE_PROVIDER: "neon",
  },
}));

vi.mock("@/lib/data", () => ({
  getStore: () => ({
    boards: {
      list: async () => [board],
      listByAccessKey: async (accessKeyId: string) => (accessKeyId === "personal" ? [board] : []),
      get: async (id: string) => (id === board.id ? board : null),
    },
  }),
}));

describe("resolveBoard", () => {
  it("stays locked when there is no session", async () => {
    const next = await resolveBoard();
    expect(next.locked).toBe(true);
    expect(next.id).toBe("");
  });

  it("unlocks the single board for an access key", async () => {
    const request = new Request("http://localhost", {
      headers: {
        cookie: `access_key_id=personal; board_session=${sessionToken("personal")}`,
      },
    });
    const next = await resolveBoard(request);
    expect(next.locked).toBe(false);
    expect(next.accessKeyId).toBe("personal");
    expect(next.id).toBe("charlotte");
    expect(next.name).toBe("Charlotte");
  });

  it("rejects a session token for a different access key", async () => {
    const request = new Request("http://localhost", {
      headers: {
        cookie: `access_key_id=personal; board_session=${sessionToken("other")}`,
      },
    });
    const next = await resolveBoard(request);
    expect(next.locked).toBe(true);
  });
});
