import { createEmptyStore } from "@/lib/data/empty";
import { catalogStore, getStore } from "@/lib/data";
import type { DataStore, SearchTab } from "@/lib/data";
import { ACCESS_COOKIE, hasSession, readCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";

export type BoardContext = {
  id: string;
  accessKeyId: string;
  orgId: string;
  name: string;
  zip: string;
  radiusMiles: number;
  centerLat: number | null;
  centerLng: number | null;
  excludeSchools: string[];
  rules: SearchTab["rules"];
  locked: boolean;
};

const emptyStore = createEmptyStore();

const lockedStub: BoardContext = {
  id: "",
  accessKeyId: "",
  orgId: env.DEMO_ORG_ID || "demo",
  name: "",
  zip: "",
  radiusMiles: 0,
  centerLat: null,
  centerLng: null,
  excludeSchools: [],
  rules: [],
  locked: true,
};

function fromBoard(tab: SearchTab, accessKeyId: string): BoardContext {
  return {
    id: tab.id,
    accessKeyId,
    orgId: env.DEMO_ORG_ID || "demo",
    name: tab.name,
    zip: tab.zip,
    radiusMiles: tab.radiusMiles,
    centerLat: tab.centerLat,
    centerLng: tab.centerLng,
    excludeSchools: tab.excludeSchools || [],
    rules: tab.rules || [],
    locked: false,
  };
}

export async function resolveBoard(request?: Request): Promise<BoardContext> {
  const accessKeyId = readCookie(request, ACCESS_COOKIE);
  if (!accessKeyId || !hasSession(request, accessKeyId)) {
    return lockedStub;
  }
  const boards = await catalogStore().boards.listByAccessKey(accessKeyId);
  const board = boards[0];
  if (!board) return lockedStub;
  return fromBoard(board, accessKeyId);
}

export async function boardContext(request?: Request): Promise<{ board: BoardContext; store: DataStore }> {
  const board = await resolveBoard(request);
  if (board.locked || !board.id) return { board, store: emptyStore };
  return { board, store: getStore(board.id) };
}
