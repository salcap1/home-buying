const SUFFIX: Record<string, string> = {
  street: "st",
  st: "st",
  avenue: "ave",
  ave: "ave",
  road: "rd",
  rd: "rd",
  drive: "dr",
  dr: "dr",
  lane: "ln",
  ln: "ln",
  court: "ct",
  ct: "ct",
  circle: "cir",
  cir: "cir",
  boulevard: "blvd",
  blvd: "blvd",
  place: "pl",
  pl: "pl",
  terrace: "ter",
  ter: "ter",
  trail: "trl",
  trl: "trl",
  parkway: "pkwy",
  pkwy: "pkwy",
};

type CsvRow = string[];

export type CsvListing = {
  name: string;
  city: string;
  location: string;
  url: string;
  price: number;
  hoa: number;
  lat: number | null;
  lng: number | null;
  highSchool: string;
  status: string;
  facts: {
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    lotSqft: number | null;
    lotAcres: number | null;
    dom: number | null;
    community: string;
  };
};

export function parseCsv(text?: string | null): CsvRow[] {
  const rows: any[] = [];
  let row: any[] = [];
  let field = "";
  let quoted = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => String(cell).trim()));
}

function headerIndex(headers: string[], ...names: string[]) {
  return headers.findIndex((header) => names.some((name) => header.includes(name)));
}

function cell(row: CsvRow, index: number) {
  return index >= 0 ? String(row[index] || "").trim() : "";
}

function money(value: unknown) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function number(value: unknown) {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function days(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function urlKey(value?: string | null) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return String(value).split("?")[0].replace(/\/+$/, "").toLowerCase();
  }
}

export function addressKey(value?: string | null) {
  const words = String(value || "")
    .toLowerCase()
    .replace(/[#.]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word && word !== "unit" && !/^apt/.test(word))
    .map((word) => SUFFIX[word] || word);
  const number = words[0] && /^\d/.test(words[0]) ? words[0] : "";
  const rest = words
    .slice(number ? 1 : 0)
    .filter((word) => !/^\d{5}(?:-\d{4})?$/.test(word))
    .filter((word) => !/^(nc|sc|ga|fl|tn|va|al|ms|md|dc)$/.test(word));
  return [number, ...rest].filter(Boolean).join(" ");
}

export function sameAddress(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  if (left === right) return true;
  return left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

export function houseKeys(house?: { url?: string | null; name?: string | null } | null) {
  const url = urlKey(house?.url);
  const address = addressKey(house?.name);
  return {
    url,
    address: address && /^\d/.test(address) ? address : "",
  };
}

export function matchesSaved(
  house: { url?: string | null; name?: string | null },
  urls: { has(value: string): boolean },
  addresses: Iterable<string | null | undefined>
) {
  const keys = houseKeys(house);
  if (keys.url && urls.has(keys.url)) return true;
  if (keys.address && [...addresses].some((item) => sameAddress(item, keys.address))) return true;
  return false;
}

export function findExisting<T extends { url?: string | null; name?: string | null }>(
  house: { url?: string | null; name?: string | null },
  existing: T[]
) {
  const keys = houseKeys(house);
  return (
    existing.find((item) => {
      const current = houseKeys(item);
      if (keys.url && current.url && keys.url === current.url) return true;
      return Boolean(keys.address && current.address && sameAddress(keys.address, current.address));
    }) || null
  );
}

export function normalizeListingStatus(value?: string | null) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (/\b(sold|closed)\b/.test(text)) return "sold";
  if (/\b(off market|withdrawn|expired|canceled|cancelled)\b/.test(text)) return "off-market";
  if (/\bcontingent\b/.test(text)) return "contingent";
  if (/\b(pending|under contract|accepting backups|backup offer)\b/.test(text)) return "pending";
  if (/\bcoming soon\b/.test(text)) return "coming-soon";
  if (/\bactive\b/.test(text)) return "active";
  return "";
}

export function isUnavailableListing(status?: string | null) {
  const key = normalizeListingStatus(status);
  return key === "sold" || key === "off-market";
}

export function listingLabel(house?: { name?: string | null; url?: string | null } | null) {
  return String(house?.name || "").trim() || "Untitled listing";
}

export function unavailableReason(status?: string | null) {
  const key = normalizeListingStatus(status);
  if (key === "sold") return "sold";
  if (key === "pending") return "pending / under contract";
  if (key === "contingent") return "contingent";
  if (key === "off-market") return "off the market";
  return "no longer available";
}

export function findDismissed<T extends { url_key?: string | null; address_key?: string | null; name?: string | null }>(
  house: { url?: string | null; name?: string | null },
  dismissed: T[]
) {
  return (
    dismissed.find((row) => {
      const urls = new Set(row.url_key ? [row.url_key] : []);
      return matchesSaved(house, urls, [row.address_key]);
    }) || null
  );
}

export function parseRedfinCsv(text?: string | null): CsvListing[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => item.trim().toUpperCase());
  const address = headerIndex(headers, "ADDRESS");
  const city = headerIndex(headers, "CITY");
  const state = headerIndex(headers, "STATE OR PROVINCE", "STATE");
  const price = headerIndex(headers, "PRICE");
  const beds = headerIndex(headers, "BEDS");
  const baths = headerIndex(headers, "BATHS");
  const sqft = headerIndex(headers, "SQUARE FEET");
  const lot = headerIndex(headers, "LOT SIZE");
  const dom = headerIndex(headers, "DAYS ON MARKET");
  const hoa = headerIndex(headers, "HOA/MONTH", "HOA");
  const url = headerIndex(headers, "URL");
  const location = headerIndex(headers, "LOCATION");
  const lat = headerIndex(headers, "LATITUDE");
  const lng = headerIndex(headers, "LONGITUDE");
  const highSchool = headerIndex(headers, "HIGH SCHOOL");
  const status = headerIndex(headers, "STATUS");

  if (address < 0 && url < 0) return [];

  return rows.slice(1).flatMap((row) => {
    const street = cell(row, address);
    const town = cell(row, city);
    const region = cell(row, state);
    const listingUrl = cell(row, url);
    if (!street && !listingUrl) return [];
    const lotSize = number(cell(row, lot));
    const name = [street, town, region].filter(Boolean).join(", ");
    return [
      {
        name: name || listingUrl,
        city: town,
        location: cell(row, location),
        url: listingUrl,
        price: money(cell(row, price)),
        hoa: money(cell(row, hoa)),
        lat: number(cell(row, lat)),
        lng: number(cell(row, lng)),
        highSchool: cell(row, highSchool),
        status: cell(row, status),
        facts: {
          beds: number(cell(row, beds)),
          baths: number(cell(row, baths)),
          sqft: number(cell(row, sqft)),
          lotSqft: lotSize && lotSize >= 400 ? lotSize : null,
          lotAcres: lotSize && lotSize < 400 ? lotSize : null,
          dom: days(cell(row, dom)),
          community: cell(row, location),
        },
      },
    ];
  });
}
