import { sessionToken } from "@/lib/auth/session";
import { boardContext, resolveBoard } from "@/lib/tenancy";

const { board } = vi.hoisted(() => ({
  board: {
    id: "board-a",
    name: "Board A",
    zip: "00000",
    radiusMiles: 20,
    centerLat: 35,
    centerLng: -80,
    excludeSchools: ["Blocked High"],
    rules: [{ kind: "max_housing" as const, config: { amount: 4000 } }],
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_SECRET: "test-session-secret",
    DEMO_ORG_ID: "demo",
    DEMO_BOARD_ID: "demo",
    DATABASE_PROVIDER: "neon",
  },
}));

vi.mock("@/lib/data", () => ({
  getStore: (boardId: string) => ({
    provider: "mock",
    boardId,
    boards: {
      list: async () => [board],
      listByAccessKey: async (accessKeyId: string) => (accessKeyId === "access-1" ? [board] : []),
      get: async (id: string) => (id === board.id ? board : null),
    },
  }),
  catalogStore: () => ({
    boards: {
      list: async () => [board],
      listByAccessKey: async (accessKeyId: string) => (accessKeyId === "access-1" ? [board] : []),
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
        cookie: `access_key_id=access-1; board_session=${sessionToken("access-1")}`,
      },
    });
    const next = await resolveBoard(request);
    expect(next.locked).toBe(false);
    expect(next.accessKeyId).toBe("access-1");
    expect(next.id).toBe("board-a");
    expect(next.name).toBe("Board A");
  });

  it("rejects a session token for a different access key", async () => {
    const request = new Request("http://localhost", {
      headers: {
        cookie: `access_key_id=access-1; board_session=${sessionToken("other")}`,
      },
    });
    const next = await resolveBoard(request);
    expect(next.locked).toBe(true);
  });
});

describe("boardContext", () => {
  it("returns the empty store while locked", async () => {
    const { board: next, store } = await boardContext();
    expect(next.locked).toBe(true);
    expect(store.provider).toBe("empty");
    expect(await store.houses.list()).toEqual([]);
  });

  it("returns a board-scoped store when unlocked", async () => {
    const request = new Request("http://localhost", {
      headers: {
        cookie: `access_key_id=access-1; board_session=${sessionToken("access-1")}`,
      },
    });
    const { board: next, store } = await boardContext(request);
    expect(next.locked).toBe(false);
    expect(next.id).toBe("board-a");
    expect((store as { boardId?: string }).boardId).toBe("board-a");
  });
});
