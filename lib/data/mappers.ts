import type { Assumptions, Destination, ExtraItem, Facts, House, School, Schools } from "@/lib/types";

export function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapAssumptions(row: any): Assumptions {
  return {
    salePrice: num(row.sale_price),
    payoff: num(row.payoff),
    extraCash: num(row.extra_cash),
    keepCash: num(row.keep_cash),
    currentHousing: num(row.current_housing),
    listingAgentPct: row.realtor_pct == null || row.realtor_pct === "" ? null : num(row.realtor_pct),
    buyerAgentPct: row.other_selling_pct == null || row.other_selling_pct === "" ? null : num(row.other_selling_pct),
    otherSellingFees: num(row.other_selling_fees),
    closingPct: num(row.closing_pct),
    termYears: num(row.term_years, 30),
    taxPct: num(row.tax_pct),
    pmiPct: num(row.pmi_pct),
    rate: num(row.rate, 6.5),
    extraItems: mapExtras(row.extra_items),
    destinations: mapDestinations(row.destinations),
    basisPaid: row.basis_paid == null || row.basis_paid === "" ? undefined : num(row.basis_paid),
    basisImprovements:
      row.basis_improvements == null || row.basis_improvements === "" ? undefined : num(row.basis_improvements),
  };
}

export function mapHouse(row: any): House {
  return {
    id: row.id,
    name: row.name,
    url: row.url || "",
    price: num(row.price),
    downDollars: num(row.down_dollars),
    rate: num(row.rate, 6.5),
    insuranceMonthly: num(row.insurance_monthly),
    taxMonthly: row.tax_monthly == null ? null : num(row.tax_monthly),
    hoa: num(row.hoa),
    updateCash: num(row.update_cash),
    extraItems: mapExtras(row.extra_items),
    lat: row.lat == null ? null : num(row.lat),
    lng: row.lng == null ? null : num(row.lng),
    schools: mapSchools(row.schools),
    facts: mapFacts(row.facts),
    photo: row.photo || "",
    notes: row.notes || "",
    hearted: Boolean(row.hearted),
    sortOrder: num(row.sort_order),
  };
}

export function mapExtras(value: unknown): ExtraItem[] {
  let items = value;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item.id || `extra-${index}`,
    label: item.label || "",
    amount: num(item.amount),
    enabled: item.enabled !== false,
  }));
}

export function mapDestinations(value: unknown): Destination[] {
  let items = value;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item.id || `place-${index}`,
    name: item.name || "",
    address: item.address || "",
    lat: item.lat == null || item.lat === "" ? null : num(item.lat),
    lng: item.lng == null || item.lng === "" ? null : num(item.lng),
  }));
}

export function mapFacts(value: unknown): Facts {
  let facts = value;
  if (typeof facts === "string") {
    try {
      facts = JSON.parse(facts);
    } catch {
      facts = {};
    }
  }
  if (!facts || typeof facts !== "object") facts = {};
  const record = facts as Record<string, unknown>;
  const n = (key: string) => (record[key] == null || record[key] === "" ? null : Number(record[key]));
  return {
    beds: n("beds"),
    baths: n("baths"),
    sqft: n("sqft"),
    lotSqft: n("lotSqft"),
    lotAcres: n("lotAcres"),
    dom: n("dom"),
    community: String(record.community || "").trim(),
    district: String(record.district || "").trim(),
    districtGeoid: String(record.districtGeoid || "").trim(),
  };
}

export function mapSchools(value: unknown): Schools {
  let schools = value;
  if (typeof schools === "string") {
    try {
      schools = JSON.parse(schools);
    } catch {
      schools = {};
    }
  }
  if (!schools || typeof schools !== "object") schools = {};
  const packed = schools as Record<string, any>;
  const wrap = (entry: any): School => {
    if (!entry) return { name: "", rating: null, source: "", url: "", lat: null, lng: null };
    if (typeof entry === "string") return { name: entry, rating: null, source: "", url: "", lat: null, lng: null };
    const lat = entry.lat == null || entry.lat === "" ? NaN : Number(entry.lat);
    const lng = entry.lng == null || entry.lng === "" ? NaN : Number(entry.lng);
    const bogusZero = entry.lat === 0 || entry.lat === "0" || entry.lng === 0 || entry.lng === "0";
    return {
      name: entry.name || "",
      rating: entry.rating == null || entry.rating === "" ? null : Number(entry.rating),
      source: entry.source || "",
      url: entry.url || "",
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      geoTried: Boolean(entry.geoTried) && !bogusZero,
    };
  };
  return {
    elementary: wrap(packed.elementary),
    middle: wrap(packed.middle),
    high: wrap(packed.high),
  };
}
