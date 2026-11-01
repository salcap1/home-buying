import { env } from "@/lib/env";
import { DataError } from "./errors";
import { createNeonStore } from "./neon/store";
import type { DataStore } from "./store";

export { DataError, dataErrorResponse, withData } from "./errors";
export { DEFAULT_DOWN } from "./neon/store";
export { mapAssumptions, mapDestinations, mapExtras, mapFacts, mapHouse, mapSchools, num } from "./mappers";
export type { DataStore, DismissedKey, HouseSummary, SchoolRating, SearchTab } from "./store";

const cached = new Map<string, DataStore>();

/** Board id used only for catalog lookups (boards / access keys), never for buyer rows. */
export const CATALOG_BOARD_ID = "_catalog";

export function getStore(boardId = env.DEMO_BOARD_ID || "demo"): DataStore {
  const existing = cached.get(boardId);
  if (existing) return existing;
  const provider = env.DATABASE_PROVIDER;
  if (provider === "neon") {
    const store = createNeonStore(boardId);
    cached.set(boardId, store);
    return store;
  }
  throw new DataError(
    `Unknown DATABASE_PROVIDER "${provider}". Add an adapter under lib/data/${provider}/ and register it here.`,
    "UNAVAILABLE"
  );
}

/** Shared store for board/access-key queries that are not scoped to a buyer board. */
export function catalogStore(): DataStore {
  return getStore(CATALOG_BOARD_ID);
}
