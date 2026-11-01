export type ExtraItem = {
  id: string;
  label: string;
  amount: number;
  enabled: boolean;
};

export type Destination = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export type School = {
  name: string;
  rating: number | null;
  source: string;
  url: string;
  lat: number | null;
  lng: number | null;
  geoTried?: boolean;
};

export type Schools = {
  elementary: School;
  middle: School;
  high: School;
};

export const EMPTY_SCHOOL: School = {
  name: "",
  rating: null,
  source: "",
  url: "",
  lat: null,
  lng: null,
};

export const EMPTY_SCHOOLS: Schools = {
  elementary: EMPTY_SCHOOL,
  middle: EMPTY_SCHOOL,
  high: EMPTY_SCHOOL,
};

export const EMPTY_FACTS: Facts = {
  beds: null,
  baths: null,
  sqft: null,
  lotSqft: null,
  lotAcres: null,
  community: "",
  district: "",
  districtGeoid: "",
  dom: null,
};

export type Facts = {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  lotAcres: number | null;
  dom: number | null;
  community: string;
  district: string;
  districtGeoid: string;
};

export type House = {
  id: string;
  name: string;
  url: string;
  price: number;
  downDollars: number;
  rate: number;
  insuranceMonthly: number;
  taxMonthly: number | null;
  hoa: number;
  updateCash: number;
  extraItems: ExtraItem[];
  lat: number | null;
  lng: number | null;
  schools: Schools;
  facts: Facts;
  photo: string;
  notes: string;
  hearted: boolean;
  sortOrder: number;
  draft?: boolean;
  highSchool?: string;
};

export type SchoolLevel = keyof Schools;

export type SchoolPin = {
  id: string;
  name: string;
  level: SchoolLevel;
  lat: number | null;
  lng: number | null;
};

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  photo?: string;
  schools?: string;
  label: string;
  html: string;
};

export type MapShape =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type SchoolDistrict = {
  geoid: string;
  name: string;
  geometry: MapShape | null;
};

export type DriveTime = {
  id?: string;
  minutes?: number | null;
  miles?: number | null;
  mode?: string;
};

export type BoardRule =
  | { kind: "max_housing"; config: { amount: number } }
  | { kind: "max_drive"; config: { destinationId: string; minutes: number } }
  | { kind: "exclude_school"; config: { pattern: string } };

export type Assumptions = {
  salePrice: number;
  payoff: number;
  extraCash: number;
  keepCash: number;
  currentHousing: number;
  listingAgentPct: number | null;
  buyerAgentPct: number | null;
  otherSellingFees: number;
  closingPct: number;
  termYears: number;
  taxPct: number;
  pmiPct: number;
  rate: number;
  extraItems: ExtraItem[];
  destinations: Destination[];
  basisPaid?: number;
  basisImprovements?: number;
};
