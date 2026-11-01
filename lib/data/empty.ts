import { DataError } from "./errors";
import type { Assumptions } from "@/lib/types";
import type { DataStore } from "./store";

const blankAssumptions: Assumptions = {
  salePrice: 0,
  payoff: 0,
  extraCash: 0,
  keepCash: 0,
  currentHousing: 0,
  listingAgentPct: null,
  buyerAgentPct: null,
  otherSellingFees: 0,
  closingPct: 0,
  termYears: 30,
  taxPct: 0,
  pmiPct: 0,
  rate: 6.5,
  extraItems: [],
  destinations: [],
};

function locked(): never {
  throw new DataError("Unlock the board first", "UNAUTHORIZED");
}

export function createEmptyStore(): DataStore {
  return {
    provider: "empty",
    houses: {
      list: async () => [],
      get: async () => null,
      create: locked,
      update: locked,
      setHearted: locked,
      remove: locked,
      touch: locked,
      mergeDistrict: locked,
      updateFactsAndSchools: locked,
      updatePhoto: locked,
      updateCosts: locked,
      updatePriceUrl: locked,
      updateImportMatch: locked,
      insertImported: locked,
      listSummaries: async () => [],
      listRefreshTargets: async () => [],
      listNeedingPhotos: async () => [],
      countNeedingPhotos: async () => 0,
      listNeedingCosts: async () => [],
      countNeedingCosts: async () => 0,
      listFactSources: async () => [],
      listAllFactSources: async () => [],
      findNeighborSchools: async () => null,
      saveSchools: locked,
    },
    assumptions: {
      get: async () => blankAssumptions,
      update: locked,
      applyCashToDownPayments: locked,
    },
    dismissed: {
      remember: locked,
      forget: async () => {},
      listKeys: async () => [],
    },
    boards: {
      list: async () => [],
      listByAccessKey: async () => [],
      get: async () => null,
      rename: locked,
      unlockByPassword: async () => null,
      createWorkspace: locked,
      setAccessPassword: locked,
    },
    areas: {
      list: async () => [],
      setSelected: locked,
    },
    ratings: {
      find: async () => null,
      save: locked,
    },
  };
}
