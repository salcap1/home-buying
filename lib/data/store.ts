import type { Assumptions, BoardRule, Facts, House, Schools } from "@/lib/types";

export type HouseSummary = {
  id: string;
  name: string;
  url: string | null;
  price: number;
  update_cash?: number;
};

export type DismissedKey = {
  url_key: string | null;
  address_key: string | null;
  name?: string | null;
};

export type SearchTab = {
  id: string;
  name: string;
  zip: string;
  radiusMiles: number;
  centerLat: number | null;
  centerLng: number | null;
  excludeSchools: string[];
  rules: BoardRule[];
};

export type BoardArea = {
  geoid: string;
  name: string;
};

export type SchoolRating = {
  name: string;
  rating: number;
  url: string;
  source: string;
};

export type DataStore = {
  provider: string;
  houses: {
    list(): Promise<House[]>;
    get(id: string): Promise<House | null>;
    create(input: Record<string, any>, down: number): Promise<House>;
    update(id: string, input: Record<string, any>): Promise<House | null>;
    setHearted(id: string, hearted: boolean): Promise<House | null>;
    remove(id: string): Promise<void>;
    touch(id: string): Promise<void>;
    mergeDistrict(id: string, district: string, districtGeoid: string): Promise<void>;
    updateFactsAndSchools(id: string, facts: Facts, schools: Schools): Promise<House | null>;
    updatePhoto(id: string, photo: string): Promise<House | null>;
    updateCosts(id: string, taxMonthly: number | null, insuranceMonthly: number): Promise<House | null>;
    updatePriceUrl(
      id: string,
      price: number,
      down: number,
      priceChanged: boolean,
      url: string | null
    ): Promise<House | null>;
    updateImportMatch(id: string, price: number, down: number, priceChanged: boolean, community: string): Promise<House>;
    insertImported(input: Record<string, any>, down: number): Promise<House>;
    listSummaries(): Promise<HouseSummary[]>;
    listRefreshTargets(): Promise<HouseSummary[]>;
    listNeedingPhotos(): Promise<{ id: string; url: string }[]>;
    countNeedingPhotos(): Promise<number>;
    listNeedingCosts(): Promise<any[]>;
    countNeedingCosts(): Promise<number>;
    listFactSources(): Promise<any[]>;
    listAllFactSources(): Promise<any[]>;
    findNeighborSchools(id: string, community: string): Promise<unknown>;
    saveSchools(id: string, schools: Schools): Promise<House>;
  };
  assumptions: {
    get(): Promise<Assumptions>;
    update(input: Record<string, any>): Promise<Assumptions>;
    applyCashToDownPayments(cashAvailable: number, closingPct: number): Promise<void>;
  };
  dismissed: {
    remember(house: { name?: string; url?: string }): Promise<void>;
    forget(house: { name?: string; url?: string }): Promise<void>;
    listKeys(): Promise<DismissedKey[]>;
  };
  boards: {
    list(): Promise<SearchTab[]>;
    listByAccessKey(accessKeyId: string): Promise<SearchTab[]>;
    get(id: string): Promise<SearchTab | null>;
    rename(id: string, name: string): Promise<SearchTab | null>;
    /** Match a unique workspace password. Returns the single board for that key. */
    unlockByPassword(password: string): Promise<{ accessKeyId: string; boards: SearchTab[] } | null>;
    /** Create a password-only workspace with one empty board. */
    createWorkspace(passwordHash: string): Promise<{ accessKeyId: string; boards: SearchTab[] }>;
    setAccessPassword(accessKeyId: string, passwordHash: string, boardIds: string[]): Promise<void>;
  };
  areas: {
    list(boardId: string): Promise<BoardArea[]>;
    setSelected(boardId: string, geoid: string, name: string, selected: boolean): Promise<void>;
  };
  ratings: {
    find(nameKey: string, level: string, state: string): Promise<SchoolRating | null>;
    save(nameKey: string, level: string, state: string, rated: SchoolRating): Promise<void>;
  };
};
