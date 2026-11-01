import { env } from "@/lib/env";
import { DataError } from "./errors";
import { createNeonStore } from "./neon/store";
import type { DataStore } from "./store";

export { DataError, dataErrorResponse, withData } from "./errors";
export { DEFAULT_DOWN } from "./neon/store";
export { mapAssumptions, mapDestinations, mapExtras, mapFacts, mapHouse, mapSchools, num } from "./mappers";
export type { DataStore, DismissedKey, HouseSummary, SchoolRating, SearchTab } from "./store";

const cached = new Map<string, DataStore>();

export function getStore(boardId = "charlotte"): DataStore {
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
