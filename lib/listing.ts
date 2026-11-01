// @ts-nocheck — scrape adapter; replace with a typed provider later.
import { addressKey, normalizeListingStatus, sameAddress } from "./redfin-csv";
import { decorateSchools } from "./schools";

function readMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]);
  }
  return "";
}

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parsePrice(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function jsonAddress(item) {
  if (!item?.address) return "";
  if (typeof item.address === "string") return cleanAddress(item.address);
  if (item.address.streetAddress) {
    return cleanAddress(
      [item.address.streetAddress, item.address.addressLocality, item.address.addressRegion].filter(Boolean).join(", ")
    );
  }
  return "";
}

function takeListingPrice(found, item) {
  const price = parsePrice(item.price || item.listingPrice);
  if (!price || price < 50000) return;
  const addr = jsonAddress(item);
  if (found.address && addr) {
    const current = addressKey(found.address);
    const incoming = addressKey(addr);
    if (current && incoming && !sameAddress(current, incoming)) return;
  } else if (found.address && !addr) {
    return;
  }
  found.price ||= price;
}

function money(n) {
  return Math.round(n * 100) / 100;
}

const STREET_SUFFIX =
  /^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|cir|circle|blvd|way|pl|place|ter|terrace|trl|trail|pkwy|hwy|loop|run|ridge|pass|xing|crossing)$/i;

const SUFFIX_EXPAND = {
  st: ["st", "street"],
  street: ["street", "st"],
  ave: ["ave", "avenue"],
  avenue: ["avenue", "ave"],
  rd: ["rd", "road"],
  road: ["road", "rd"],
  dr: ["dr", "drive"],
  drive: ["drive", "dr"],
  ln: ["ln", "lane"],
  lane: ["lane", "ln"],
  ct: ["ct", "court"],
  court: ["court", "ct"],
  cir: ["cir", "circle"],
  circle: ["circle", "cir"],
  blvd: ["blvd", "boulevard"],
  boulevard: ["boulevard", "blvd"],
  pl: ["pl", "place"],
  place: ["place", "pl"],
  ter: ["ter", "terrace"],
  terrace: ["terrace", "ter"],
};

function splitStreetCityState(slug) {
  const pieces = slug.split(/[-_+]+/).filter(Boolean);
  const zipIndex = pieces.findIndex((part) => /^\d{5}$/.test(part));
  const usable = zipIndex > 0 ? pieces.slice(0, zipIndex) : pieces;
  const stateIndex = [...usable].findLastIndex((part) => /^[A-Za-z]{2}$/.test(part));
  const state = stateIndex >= 0 ? usable[stateIndex] : "";
  const beforeState = stateIndex >= 0 ? usable.slice(0, stateIndex) : usable;
  const suffixIndex = [...beforeState].findLastIndex((part) => STREET_SUFFIX.test(part));
  if (suffixIndex >= 0) {
    const street = beforeState.slice(0, suffixIndex + 1).join(" ");
    const city = beforeState.slice(suffixIndex + 1).join(" ");
    return [street, city, state].filter(Boolean).join(", ");
  }
  return [...beforeState, state].filter(Boolean).join(" ");
}

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^(SC|NC|GA|FL|TN|VA|MD|DC|AL|MS)$/i.test(word)) return word.toUpperCase();
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function cleanAddress(value) {
  if (!value) return "";
  let text = decode(String(value))
    .replace(/\+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
  text = text.split("|")[0].split(" - ")[0].trim();
  text = text.replace(/,?\s*(homes? for sale|for sale|zillow|realtor|redfin).*$/i, "").trim();
  text = text.replace(/\s+\d+\s*beds?\/.*$/i, "").trim();
  text = text.replace(/\s+mls\b.*$/i, "").trim();
  const zip = text.match(/\b(29\d{3}|28[0-2]\d{2})\b/);
  const inferredState = zip ? (zip[1].startsWith("29") ? "SC" : "NC") : "";
  const placed = text.match(/^(.+?,\s*[A-Za-z .]+,\s*[A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?.*$/);
  if (placed) text = placed[1];
  else {
    const cityZip = text.match(/^(.+?,\s*[A-Za-z .]+),\s*\d{5}(?:-\d{4})?/);
    if (cityZip && inferredState) text = `${cityZip[1]}, ${inferredState}`;
    else text = text.replace(/\s+\d{5}(?:-\d{4})?\b.*$/, "").trim();
  }
  text = text.replace(/\b([A-Za-z][A-Za-z .]+)\s+\1,\s*([A-Z]{2})\b/i, "$1, $2");
  text = text.replace(/\b([A-Za-z][A-Za-z .]+)\s+\1\s+([A-Z]{2})\b/i, "$1, $2");
  if (!/\d/.test(text)) return "";
  return titleCase(text);
}

function streetAddress(value) {
  const text = cleanAddress(value);
  return /^\d+\s+[A-Za-z]/.test(text) ? text : "";
}

export function mlsFromText(value) {
  const text = String(value || "");
  const labeled =
    text.match(/\b(?:mls|cmls|mls#|mls\s*(?:number|id|#)|pid)\b[:\s=#_-]*([A-Z]{0,4})?(\d{6,8})\b/i) ||
    text.match(/\bCMLS(\d{6,8})\b/i) ||
    text.match(/\/mls[-_]?(\d{6,8})\b/i);
  if (labeled) return labeled[labeled.length - 1];
  return "";
}

export function mlsFromUrl(url) {
  try {
    const parsed = new URL(url);
    for (const key of ["PID", "pid", "mls", "mlsId", "mlsID", "mlsNumber", "MLSID", "listingId"]) {
      const match = String(parsed.searchParams.get(key) || "").match(/(\d{6,8})/);
      if (match) return match[1];
    }
    return mlsFromText(`${parsed.pathname}?${parsed.search}`);
  } catch {
    return mlsFromText(url);
  }
}

function mlsFromHtml(html) {
  if (!html) return "";
  return (
    mlsFromText(html.match(/"mls(?:Id|ID|Number|No)?"\s*:\s*"?(?:CMLS)?(\d{6,8})/i)?.[0] || "") ||
    mlsFromText(html.match(/MLS(?:\s*#|\s*Number)?[:\s]*([A-Z]{0,4})?(\d{6,8})/i)?.[0] || "") ||
    mlsFromText(html)
  );
}

function mlsMirrorUrls(mls) {
  if (!mls) return [];
  return [`https://www.carolinarealtysearch.com/property/${mls}/`];
}

function zillowSlug(address) {
  const parsed = parseAddress(address);
  if (!parsed.number || !parsed.street) return "";
  return [parsed.number, parsed.street, parsed.city, parsed.state].filter(Boolean).join(" ").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function zillowMirrorUrls(address) {
  const slug = zillowSlug(address);
  if (!slug) return [];
  return [`https://www.zillow.com/homes/${slug}_rb/`, `https://www.zillow.com/homedetails/${slug}/`];
}

function zillowDetailUrl(html, currentUrl = "") {
  if (/zillow\.com\/homedetails\//i.test(currentUrl)) return currentUrl.split("?")[0];
  const match =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["'](https?:\/\/www\.zillow\.com\/homedetails\/[^"']+)/i) ||
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["'](https?:\/\/www\.zillow\.com\/homedetails\/[^"']+)/i) ||
    html.match(/https?:\/\/www\.zillow\.com\/homedetails\/[A-Za-z0-9\-/%._]+_zpid\/?/i);
  return match ? decode(match[1] || match[0]).split("?")[0] : "";
}

function listingUrlRank(url) {
  const value = String(url || "");
  if (/redfin\.com\/.+\/home\//i.test(value)) return 4;
  if (/zillow\.com\/homedetails\//i.test(value)) return 3;
  if (/zillow\.com/i.test(value)) return 2;
  if (/carolinarealtysearch\.com/i.test(value)) return 0;
  return 1;
}

function preferListingUrl(current, candidate) {
  if (!candidate) return current || "";
  if (!current) return candidate;
  const candidateRank = listingUrlRank(candidate);
  const currentRank = listingUrlRank(current);
  if (candidateRank > currentRank) return candidate;
  if (candidateRank < currentRank) return current;
  if (/,/.test(current) && !/,/.test(candidate)) return candidate;
  if (/homedetails/i.test(candidate) && !/homedetails/i.test(current)) return candidate;
  return current;
}

export function isChallengeHtml(html) {
  const text = html || "";
  const marker = /gokuProps|awsWafCookieDomainList|challenge-container|just a moment/i.test(text);
  if (!marker) return false;
  // Redfin embeds awsWafCookieDomainList on real listing pages. A page with a price is the listing.
  if (text.length > 50000 && /\$[0-9,]{5,}/.test(text)) return false;
  return true;
}

export function addressFromUrl(url) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname);

    const zillow = path.match(/\/homedetails\/([^/]+?)(?:\/|$)/i);
    if (zillow) return cleanAddress(splitStreetCityState(zillow[1]));

    const realtor = path.match(/\/realestateandhomes-detail\/([^/]+)/i);
    if (realtor) {
      const chunks = realtor[1].split("_").filter((part) => !/^M\d/i.test(part) && !/^\d{5}/.test(part));
      if (chunks.length >= 3) {
        const state = chunks[chunks.length - 1];
        const city = chunks[chunks.length - 2];
        const street = chunks.slice(0, -2).join(" ");
        return cleanAddress(`${street}, ${city}, ${state}`);
      }
      return cleanAddress(chunks.join(", "));
    }

    const redfin = path.match(/\/([A-Z]{2})\/([^/]+)\/([^/]+)-\d{5}(?:\/|$)/i);
    if (redfin) {
      return cleanAddress(`${redfin[3].replace(/-/g, " ")}, ${redfin[2].replace(/-/g, " ")}, ${redfin[1]}`);
    }

    const generic = path.match(/(\d{1,6}[-+][A-Za-z].+?)(?:\/|$)/);
    if (generic) return cleanAddress(generic[1]);
  } catch {
    // ignore bad URLs
  }
  return "";
}

export function parseAddress(value) {
  const text = cleanAddress(value);
  const match = text.match(/^(\d+[A-Za-z]?)\s+(.+?),\s*([^,]+),\s*([A-Z]{2})\b/i);
  if (!match) {
    const loose = text.match(/^(\d+[A-Za-z]?)\s+([^,]+)(?:,\s*([^,]+))?/i);
    if (!loose) return { raw: text, number: "", street: "", city: "", state: "" };
    return {
      raw: text,
      number: loose[1],
      street: loose[2].trim(),
      city: (loose[3] || "").trim(),
      state: "",
    };
  }
  return {
    raw: text,
    number: match[1],
    street: match[2].trim(),
    city: match[3].trim(),
    state: match[4].toUpperCase(),
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function streetSlugs(street) {
  const words = street.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const last = words[words.length - 1].toLowerCase().replace(/\./g, "");
  const head = words.slice(0, -1).map((word) => word.toLowerCase());
  const suffixes = SUFFIX_EXPAND[last] || [last];
  return [...new Set(suffixes.map((suffix) => slugify([...head, suffix].join(" "))))];
}

function looselyIncludes(haystack, needle) {
  const hay = String(haystack || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const need = String(needle || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!need || need.length < 4) return hay.includes(need);
  if (hay.includes(need) || need.includes(hay)) return true;
  let i = 0;
  let skips = 0;
  for (const ch of hay) {
    if (ch === need[i]) i += 1;
    else skips += 1;
    if (skips > 2) return false;
    if (i === need.length) return true;
  }
  return i === need.length;
}

const RANK = { history: 5, payment: 4, listed: 3, quarterly: 2, estimate: 1 };

function taxMonthlyCap(price) {
  if (!price) return 900;
  return Math.min(1200, Math.max(900, (Number(price) * 0.018) / 12));
}

function saneTaxMonthly(n, price) {
  return Number.isFinite(n) && n >= 40 && n <= taxMonthlyCap(price);
}

function pickTaxHistory(history, price) {
  const yearlyCap = taxMonthlyCap(price) * 12;
  const valid = history.filter((row) => row.annual >= 800 && row.annual <= yearlyCap);
  if (!valid.length) return null;
  valid.sort((a, b) => b.year - a.year);
  if (valid.length >= 2) {
    const others = valid.slice(1).map((row) => row.annual).sort((a, b) => a - b);
    const median = others[Math.floor(others.length / 2)];
    if (valid[0].annual > median * 2.2) return valid[1];
  }
  return valid[0];
}

function take(found, key, value, source) {
  if (value == null || !Number.isFinite(value)) return;
  const rank = RANK[source] || 0;
  const current = found[`${key}Rank`] || 0;
  if (rank >= current) {
    found[key] = money(value);
    found[`${key}Rank`] = rank;
    found[`${key}Source`] = source;
  }
}

function frequencyHint(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return "";
  const parts: any[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (value == null || typeof value === "object") continue;
    if (/freq|period|interval|schedule/i.test(key)) parts.push(String(value));
  }
  return parts.join(" ");
}

function walkJson(node, found, options = {}, depth = 0) {
  if (!node || typeof node !== "object" || depth > 14) return;
  const skipTaxInsurance = options.skipTaxInsurance;
  const items = Array.isArray(node) ? node : [node];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const listed = jsonAddress(item);
    if (addressConflicts(found.address, listed)) continue;
    if (item.offers) walkJson(item.offers, found, options, depth + 1);
    takeListingPrice(found, item);
    if (item.address) {
      const address = item.address;
      if (typeof address === "string") found.address ||= cleanAddress(address);
      else if (address.streetAddress) {
        found.address ||= cleanAddress(
          [address.streetAddress, address.addressLocality, address.addressRegion].filter(Boolean).join(", ")
        );
      }
    }
    if (!skipTaxInsurance) {
      if (item.homeInsuranceYearlyEstimate != null) {
        const monthly = Number(item.homeInsuranceYearlyEstimate) / 12;
        if (monthly >= 40 && monthly <= 800) take(found, "insuranceMonthly", monthly, "payment");
      }
    }
    if (item.monthlyHoaDues != null) {
      const hoa = hoaToMonthly(item.monthlyHoaDues, "monthly");
      if (hoa != null && hoa <= 2000) take(found, "hoa", hoa, "listed");
    }
    takeFactsFromItem(found, item);
    const nearbyFreq = frequencyHint(item);
    for (const [key, value] of Object.entries(item)) {
      const k = key.toLowerCase();
      if (
        !skipTaxInsurance &&
        /tax/.test(k) &&
        /annual|paid|amount|history|propertytax/.test(k) &&
        !/rate|percent|estimate/.test(k)
      ) {
        const monthly = taxToMonthly(value, found.price);
        if (monthly) take(found, "taxMonthly", monthly, "listed");
      }
      if (/hoa|associationfee|assocfee|monthlyhoa/.test(k) && !/yn|flag|has|include|name|freq|period|interval/.test(k)) {
        const freq = `${nearbyFreq} ${frequencyHint(value)}`;
        const hoa = hoaToMonthly(value, freq);
        if (hoa != null) {
          const labeledMonthly = /monthly/.test(k) || /month|\/mo/i.test(`${value} ${freq}`);
          const quarterly = /qtr|quarter/i.test(`${value} ${freq}`);
          take(found, "hoa", hoa, quarterly ? "quarterly" : labeledMonthly ? "listed" : "estimate");
        }
      }
      if (
        !skipTaxInsurance &&
        /insurance|hazardins|homeins/.test(k) &&
        !/rate|percent|yn|flag|flood/.test(k)
      ) {
        const monthly = insuranceToMonthly(value);
        if (monthly) take(found, "insuranceMonthly", monthly, "listed");
      }
      if (/days?onmarket|timeonredfin|timeonmarket|^dom$/.test(k)) takeDom(found, value);
      if (
        /^(mlsstatus|listingstatus|salestatus|propertystatus|sashtypename|searchstatus)$/.test(k) &&
        typeof value === "string"
      ) {
        takeStatus(found, value);
      }
      const schoolKey = schoolLevelFromKey(k);
      if (/^(subdivision|subdivisionname|neighborhood|neighborhoodname|communityname|marketarea)$/.test(k) && typeof value === "string") {
        takeCommunity(found, value);
      }
      if (schoolKey && typeof value === "string") takeSchool(found, schoolKey, value);
      if (value && typeof value === "object") walkJson(value, found, options, depth + 1);
    }
  }
}

function emptyFacts() {
  return { beds: null, baths: null, sqft: null, lotSqft: null, lotAcres: null, dom: null, community: "" };
}

const STATUS_RANK = { sold: 5, pending: 4, contingent: 4, "off-market": 3, "coming-soon": 2, active: 1 };

function takeStatus(found, value) {
  const status = normalizeListingStatus(value);
  if (!status) return;
  const rank = STATUS_RANK[status] || 0;
  if (rank >= (found.statusRank || 0)) {
    found.status = status;
    found.statusRank = rank;
  }
}

function scrapeStatus(html, found) {
  for (const match of html.matchAll(
    /"(?:mlsStatus|listingStatus|saleStatus|propertyStatus|sashTypeName|searchStatus)"\s*:\s*"([^"]+)"/gi
  )) {
    takeStatus(found, match[1]);
  }
  const banner =
    html.match(/status-badge[^>]*>\s*([^<]+)/i) ||
    html.match(/ListingStatusBanner[^>]*>\s*([^<]+)/i) ||
    html.match(
      /\b(Coming Soon|Active Under Contract|Under Contract Taking Backups|Under Contract|Contingent|Pending|Sold|Off Market)\b/i
    );
  if (banner) takeStatus(found, banner[1]);
}

function communityLooksJunk(name) {
  return /amenities|activities|association|listing agent|clubhouse|beautifully|maintained|sought-after|perfect blend|ideally situated|part of|include a|featuring|floorplan|sidewalks|restrictions|thoughtful|\bshow\b|owner\./i.test(
    name || ""
  );
}

function cleanCommunity(value) {
  const name = decode(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/['‘’]/g, "")
    .trim();
  if (!name || name.length < 3 || name.length > 48) return "";
  if (/[\\{}"<>]/.test(name)) return "";
  if (!/^[A-Z][A-Za-z]/.test(name)) return "";
  if (/\./.test(name)) return "";
  if (/district|school|click|learn more|see more|n\/a|none|unknown/i.test(name)) return "";
  if (/^(in|the|this|a|an|of|and|with|including|featuring|restrictions|community|desirable)\b/i.test(name)) {
    if (!/^The\s+[A-Z]/.test(name)) return "";
  }
  if (communityLooksJunk(name)) return "";
  return name;
}

function takeCommunity(found, value, overwrite = false) {
  found.facts ||= emptyFacts();
  const name = cleanCommunity(value);
  if (!name) return;
  const current = found.facts.community;
  if (current && !communityLooksJunk(current) && (!overwrite || communityLooksJunk(name))) return;
  found.facts.community = name;
}

function factNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    return factNumber(value.value ?? value.amount ?? value.display ?? value.valueInSqFt);
  }
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function takeFact(found, key, value, overwrite = false) {
  found.facts ||= emptyFacts();
  const n = factNumber(value);
  if (n == null) return;
  if (overwrite || found.facts[key] == null) found.facts[key] = n;
}

const DOM_RANK = { insight: 5, redfin: 4, labeled: 3, listed: 2, cumulative: 1 };

function parseDom(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/< ?1|today|just listed|hours?/i.test(text) && !/\d+\s*days?/i.test(text)) return 0;
  const n = Number(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 2000) return null;
  return Math.round(n);
}

function daysSince(value) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

function takeDom(found, value, source = "listed") {
  found.facts ||= emptyFacts();
  const n = parseDom(value);
  if (n == null) return;
  if (n === 0 && source !== "insight" && source !== "redfin") return;
  const rank = DOM_RANK[source] || 2;
  if (rank >= (found.domRank || 0)) {
    found.facts.dom = n;
    found.domRank = rank;
  }
}

function scrapeDom(html, found) {
  const insight = html.match(
    /bp-InsightCard__title-text">\s*DAYS ON MARKET\s*<[\s\S]{0,280}?bp-InsightCard__header">\s*(\d+)/i
  );
  if (insight) takeDom(found, insight[1], "insight");

  const onRedfin =
    html.match(/<b>\s*(\d+)\s*days?\s*<\/b>\s*on Redfin/i) ||
    html.match(/(\d+)\s*days?\s+on Redfin/i);
  if (onRedfin) takeDom(found, onRedfin[1], "redfin");

  const timeOn = html.match(/Time on Redfin[:\s<][^0-9]{0,60}(\d+)\s*days?/i);
  if (timeOn) takeDom(found, timeOn[1], "redfin");

  const labeled =
    html.match(/days on (?:the )?market[:\s]+(\d+)/i) ||
    html.match(/time on redfin[:\s]+(\d+)/i);
  if (labeled) takeDom(found, labeled[1], "labeled");

  const listed = html.match(
    /BasicTable__col event">\s*Listed\s*<\/div>\s*<div class="BasicTable__col date">\s*([^<]+)/i
  );
  if (listed) {
    const days = daysSince(listed[1]);
    if (days != null) takeDom(found, days, "listed");
  }
}

function takeFactsFromItem(found, item) {
  if (!item || typeof item !== "object") return;
  takeCommunity(
    found,
    item.subdivision ||
      item.subdivisionName ||
      item.neighborhood ||
      item.neighborhoodName ||
      item.communityName ||
      item.marketArea
  );
  takeFact(found, "beds", item.numberOfBedrooms ?? item.numBeds ?? item.beds ?? item.bedrooms);
  takeFact(found, "baths", item.numberOfBathroomsTotal ?? item.numBaths ?? item.baths ?? item.bathrooms);
  takeFact(found, "sqft", item.sqFt ?? item.livingArea ?? item.squareFeet ?? item.finishedSqFt);
  takeDom(found, item.daysOnMarket ?? item.timeOnRedfin ?? item.cumulativeDaysOnMarket ?? item.dom ?? item.timeOnMarket);
  const lot = item.lotSize ?? item.lotSqFt ?? item.lotSizeSquareFeet;
  if (lot && typeof lot === "object") {
    const unit = String(lot.unitCode || lot.unitText || "").toLowerCase();
    const n = factNumber(lot);
    if (n == null) return;
    if (/acre|acr/.test(unit) || n < 40) takeFact(found, "lotAcres", n);
    else takeFact(found, "lotSqft", n);
    return;
  }
  const n = factNumber(lot);
  if (n == null) return;
  if (n < 40) takeFact(found, "lotAcres", n);
  else takeFact(found, "lotSqft", n);
}

function scrapeFacts(html, found) {
  const meta = `${readMeta(html, "og:description")} ${readMeta(html, "description")}`;
  const fromMeta = meta.match(/(\d+(?:\.\d+)?)\s*beds?,?\s*(\d+(?:\.\d+)?)\s*baths?[^0-9]{0,12}([\d,]+)\s*sq/i);
  if (fromMeta) {
    takeFact(found, "beds", fromMeta[1], true);
    takeFact(found, "baths", fromMeta[2], true);
    takeFact(found, "sqft", fromMeta[3], true);
  }

  const text = visibleText(html);
  const hero = text.match(/(\d+(?:\.\d+)?)\s*(?:bd|beds?)\W{1,8}(\d+(?:\.\d+)?)\s*(?:ba|baths?)\W{1,12}([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i);
  if (hero) {
    takeFact(found, "beds", hero[1], true);
    takeFact(found, "baths", hero[2], true);
    takeFact(found, "sqft", hero[3], true);
  }

  const lotSqft = text.match(/([\d,]+)\s*sq\s*ft\s*lot size/i) || text.match(/lot size[:\s]+([\d,]+)\s*sq/i);
  if (lotSqft) takeFact(found, "lotSqft", lotSqft[1], true);

  const lotAcres = text.match(/lot size(?:\s*acres?)?[:\s]+([\d.]+)\s*acres?/i) || text.match(/([\d.]+)\s*acres?\s*lot/i);
  if (lotAcres) takeFact(found, "lotAcres", lotAcres[1], true);

  scrapeDom(html, found);
  scrapeSubdivision(html, found);
}

function scrapeSubdivision(html, found) {
  const labeled = [
    /table-label">\s*Subdivision(?:\s*Name)?\s*<\/span>[\s\S]{0,200}?table-value">\s*([^<]+)/i,
    /keyDetails-label">[\s\S]{0,80}?Subdivision[\s\S]{0,160}?keyDetails-value">\s*([^<]+)/i,
    /Subdivision(?:\s*(?:Name|&(?:amp;)?\s*Development))?:?\s*<\/[^>]+>\s*([^<]{3,48})/i,
    /<dt[^>]*>\s*Subdivision(?:\s*Name)?\s*<\/dt>\s*<dd[^>]*>\s*([^<]+)/i,
    /Subdivision(?:\s*Name)?[:\s]+([A-Z][A-Za-z0-9][A-Za-z0-9 '/-]{1,36})(?=[^A-Za-z0-9'/-]|$)/,
    /Community Name[:\s]+([A-Z][A-Za-z0-9][A-Za-z0-9 '/-]{1,36})(?=[^A-Za-z0-9'/-]|$)/,
    /Complex(?:\s*Name)?[:\s]+([A-Z][A-Za-z0-9][A-Za-z0-9 '/-]{1,36})(?=[^A-Za-z0-9'/-]|$)/,
    /Part of the ['‘’"]([^'‘’"]{3,40})['‘’"] association/i,
  ];
  for (const pattern of labeled) {
    const match = html.match(pattern);
    if (match) takeCommunity(found, match[1], true);
    if (found.facts?.community && !communityLooksJunk(found.facts.community)) return;
  }
}

export function coldwellListingUrl(address) {
  const parsed = parseAddress(address);
  if (!parsed.number || !parsed.street || !parsed.city || !parsed.state) return "";
  return `https://www.coldwellbankerhomes.com/${parsed.state.toLowerCase()}/${slugify(parsed.city)}/${parsed.number}-${slugify(parsed.street)}/`;
}

const FOSTER_STATES = new Set(["VA", "MD", "DC"]);

export function longFosterCityUrl(address) {
  const parsed = parseAddress(address);
  if (!parsed.city || !FOSTER_STATES.has(parsed.state)) return "";
  const city = encodeURIComponent(parsed.city.trim().replace(/\s+/g, "_"));
  return `https://www.longandfoster.com/realestate/search/city/${city}/${parsed.state}`;
}

function taxToMonthly(value, price) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return taxToMonthly(value.taxPaid ?? value.tax ?? value.amount ?? value.value, price);
  }
  if (Array.isArray(value) && value[0]) return taxToMonthly(value[0], price);
  const text = String(value ?? "");
  const n = parsePrice(value);
  if (!n) return 0;
  if (n > 0 && n < 8 && price) return money((price * (n > 1 ? n : n * 100)) / 100 / 12);
  if (/month|\/mo/i.test(text) || (n >= 80 && n <= 1800)) return money(n);
  if (n > 1800) return money(n / 12);
  return 0;
}

function hoaToMonthly(value, frequency) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return null;
  const text = `${value} ${frequency || ""}`;
  if (/\bnone\b|n\/a|not applicable/i.test(text)) return 0;
  const n = parsePrice(value);
  if (!Number.isFinite(n) || (n === 0 && !/[\d$]/.test(String(value)))) return null;
  if (/qtr|quarter/i.test(text)) return money(n / 3);
  if (/semi|\/6\s*mo/i.test(text)) return money(n / 6);
  if (/year|annual|\/yr/i.test(text) || n > 2000) return money(n / 12);
  return money(n);
}

function insuranceToMonthly(value) {
  if (value == null || value === "") return 0;
  const text = String(value);
  const n = parsePrice(value);
  if (!n) return 0;
  if (/year|annual|\/yr/i.test(text) || n > 800) return money(n / 12);
  return money(n);
}

function visibleText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function scrapeRedfinCosts(html, found) {
  const yearlyIns = html.match(/homeInsuranceYearlyEstimate\\?"\s*:\s*([0-9.]+)/i);
  if (yearlyIns) {
    const monthly = Number(yearlyIns[1]) / 12;
    if (monthly >= 40 && monthly <= 800) take(found, "insuranceMonthly", monthly, "listed");
  }

  const taxRow = html.match(/Property taxes<\/span>[\s\S]{0,280}?\$([0-9,]+(?:\.\d{1,2})?)/i);
  if (taxRow) {
    const n = parsePrice(taxRow[1]);
    if (saneTaxMonthly(n, found.price)) take(found, "taxMonthly", n, "payment");
  }

  const insRow = html.match(/Home insurance<\/span>[\s\S]{0,280}?\$([0-9,]+(?:\.\d{1,2})?)/i);
  if (insRow) {
    const n = parsePrice(insRow[1]);
    if (n >= 40 && n <= 800) take(found, "insuranceMonthly", n, "payment");
  }
}

function scrapeLabeledFacts(html, found, options = {}) {
  const skipTaxInsurance = options.skipTaxInsurance;
  const text = visibleText(html);

  if (!skipTaxInsurance) {
    for (const match of text.matchAll(/property taxes?\s*\$([0-9,]+(?:\.\d{1,2})?)/gi)) {
      const n = parsePrice(match[1]);
      if (saneTaxMonthly(n, found.price)) take(found, "taxMonthly", n, "payment");
    }

    const history: any[] = [];
    for (const match of html.matchAll(
      /tax-history-data-year">\s*(20\d{2})\s*<\/div>\s*<div class="tax-history-data tax-history-data-tax">\s*\$([0-9,]+)/gi
    )) {
      history.push({ year: Number(match[1]), annual: parsePrice(match[2]) });
    }
    for (const match of html.matchAll(
      /BasicTable__col year">\s*(20\d{2})\s*<\/div>\s*<div class="BasicTable__col propertyTax">\s*\$([0-9,]+)/gi
    )) {
      history.push({ year: Number(match[1]), annual: parsePrice(match[2]) });
    }
    for (const match of html.matchAll(
      /class="BasicTable__col year">\s*(20\d{2})\s*<\/div>\s*<div class="BasicTable__col propertyTax">\s*\$([0-9,]+)/gi
    )) {
      history.push({ year: Number(match[1]), annual: parsePrice(match[2]) });
    }
    for (const match of text.matchAll(/(20\d{2})\s+(?:property\s*)?taxes?\s+\$([0-9,]+)/gi)) {
      history.push({ year: Number(match[1]), annual: parsePrice(match[2]) });
    }
    for (const match of text.matchAll(/(20\d{2})\s+\$([0-9,]{3,})\s*\(\+?-?\d/g)) {
      const annual = parsePrice(match[2]);
      if (annual >= 800 && annual <= 30000) history.push({ year: Number(match[1]), annual });
    }
    const latest = pickTaxHistory(history, found.price);
    if (latest) take(found, "taxMonthly", latest.annual / 12, "history");
  }

  if (!skipTaxInsurance) {
    const annualTax = text.match(/annual tax(?:es)?[^$]{0,40}\$([0-9,]+(?:\.\d{2})?)/i);
    if (annualTax) {
      const monthly = taxToMonthly(annualTax[0], found.price);
      if (monthly) take(found, "taxMonthly", monthly, "listed");
    }
    const taxAnnualAmount = text.match(/tax annual amount\s*:?\s*\$([0-9,]+(?:\.\d{2})?)/i);
    if (taxAnnualAmount) {
      const monthly = taxToMonthly(taxAnnualAmount[0], found.price);
      if (monthly) take(found, "taxMonthly", monthly, "listed");
    }
  }

  for (const match of text.matchAll(
    /hoa(?:\s*dues?|\s*fee)?[^$]{0,40}\$([0-9,]+(?:\.\d{1,2})?)\s*(?:\/\s*)?(month|mo|monthly|qtr|quarter(?:ly)?|year|yr|annual(?:ly)?)?/gi
  )) {
    const hoa = hoaToMonthly(match[0]);
    if (hoa == null) continue;
    const source = /qtr|quarter/i.test(match[0])
      ? "quarterly"
      : /month|\/mo/i.test(match[0])
        ? "listed"
        : "estimate";
    take(found, "hoa", hoa, source);
  }

  const dues = text.match(/(?:dues|hoa)\s*\$([0-9,]+(?:\.\d{1,2})?)\s*\/\s*qtr/i);
  if (dues) take(found, "hoa", parsePrice(dues[1]) / 3, "quarterly");

  const assoc = text.match(
    /association fee[:\s]*\$([0-9,]+(?:\.\d{1,2})?)[\s\S]{0,120}?assoc(?:iation)? fee freq\.?[:\s]*(monthly|quarterly|annual(?:ly)?|semi-?annual(?:ly)?)/i
  );
  if (assoc) {
    const hoa = hoaToMonthly(assoc[1], assoc[2]);
    if (hoa != null) take(found, "hoa", hoa, /quarter/i.test(assoc[2]) ? "quarterly" : "listed");
  }

  const fosterHoa = text.match(
    /association fee\s*:?\s*\$([0-9,]+(?:\.\d{1,2})?)[\s\S]{0,180}?association fee frequency\s*:?\s*(monthly|quarterly|annually|annual|semi-annually|semi-annual)/i
  );
  if (fosterHoa) {
    const hoa = hoaToMonthly(fosterHoa[1], fosterHoa[2]);
    if (hoa != null) take(found, "hoa", hoa, /quarter/i.test(fosterHoa[2]) ? "quarterly" : "listed");
  }

  const hoaFee = text.match(/hoa fee[:\s]*\$([0-9,]+(?:\.\d{1,2})?)\s*\/\s*(month|mo|qtr|year)/i);
  if (hoaFee) take(found, "hoa", hoaToMonthly(hoaFee[0]), /qtr/i.test(hoaFee[2]) ? "quarterly" : "listed");

  if (/tax annual amount|association fee frequency/i.test(text)) {
    const beds = text.match(/(\d+)\s+bedrooms?\b/i);
    if (beds) takeFact(found, "beds", beds[1]);
    const full = text.match(/(\d+)\s+full bathrooms?\b/i);
    const half = text.match(/(\d+)\s+half bathrooms?\b/i);
    if (full) takeFact(found, "baths", Number(full[1]) + (half ? Number(half[1]) * 0.5 : 0));
    const sqft = text.match(/sq\.?\s*ft\.?\s*:?\s*([\d,]+)/i);
    if (sqft) takeFact(found, "sqft", sqft[1]);
    const acres = text.match(/\blot\s*:?\s*([\d.]+)\s*acres?\b/i);
    if (acres) takeFact(found, "lotAcres", acres[1]);
  }

  for (const match of text.matchAll(/hoa dues[^$]{0,40}\$([0-9,]+(?:\.\d{1,2})?)/gi)) {
    const n = parsePrice(match[1]);
    if (n >= 0 && n <= 40) take(found, "hoa", n, "payment");
    else if (n <= 1500) take(found, "hoa", n, "estimate");
  }

  if (!skipTaxInsurance) {
    for (const match of text.matchAll(/home(?:owners?)? insurance\s*\$([0-9,]+(?:\.\d{1,2})?)/gi)) {
      const monthly = insuranceToMonthly(match[0]);
      if (monthly >= 40 && monthly <= 800) take(found, "insuranceMonthly", monthly, "payment");
    }
  }

  scrapeSchools(html, found);
}

function schoolLevelFromKey(key) {
  if (/^(assigned)?elementary(school|schoolname)?$/.test(key)) return "elementary";
  if (/^(assigned)?middle(school|schoolname)?$/.test(key)) return "middle";
  if (/^(assigned)?high(school|schoolname)?$/.test(key)) return "high";
  return "";
}

function cleanSchool(value) {
  let name = decode(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/school assignments? may change.*$/i, "")
    .trim();
  name = name.replace(/[,|;].*$/, "").trim();
  name = name.replace(/^School\s+/i, "").trim();
  if (!name || name.length < 3 || name.length > 80) return "";
  if (/[\\{}"<>]/.test(name)) return "";
  if (/^\d/.test(name) || /within walking|walking distance/i.test(name)) return "";
  if (
    /district|contact|verify|assignment|no schools|experience|sucks|enough|nearby|click|learn more/i.test(name) &&
    !/elementary|middle|high/i.test(name)
  ) {
    return "";
  }
  if (!/^[A-Za-z0-9 .'/-]+$/.test(name)) return "";
  const words = name.split(/\s+/);
  if (words.length > 6) return "";
  return titleCase(name);
}

function takeSchool(found, level, value) {
  found.schools ||= {};
  const name = cleanSchool(value);
  if (!name) return;
  const current = cleanSchool(found.schools[level]);
  if (current && current.length >= name.length) return;
  found.schools[level] = name;
}

function scrapeSchools(text, found) {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const assigned = [
    [/elementary school[:\s]+(.+?)(?=\s+(?:middle school|high school|school district)|$)/i, "elementary"],
    [/middle school[:\s]+(.+?)(?=\s+(?:high school|school district|grades)|$)/i, "middle"],
    [/high school[:\s]+(.+?)(?=\s+(?:school district|school assignments?|listing|building)|$)/i, "high"],
  ];
  for (const [pattern, level] of assigned) {
    const match = plain.match(pattern);
    if (match) takeSchool(found, level, match[1]);
  }

  const fosterSchools = [
    [/elementary school\s*:?\s*([A-Za-z][A-Za-z0-9 .'/-]{1,40}?)(?=\s+middle\b|\s+high school\b|$)/i, "elementary"],
    [/middle(?:\s+or\s+junior)?\s+school\s*:?\s*([A-Za-z][A-Za-z0-9 .'/-]{1,40}?)(?=\s+high school\b|$)/i, "middle"],
    [/high school\s*:?\s*([A-Za-z][A-Za-z0-9 .'/-]{1,40}?)(?=\s+listing\b|\s+building\b|\s+real estate\b|$)/i, "high"],
  ];
  for (const [pattern, level] of fosterSchools) {
    const match = plain.match(pattern);
    if (match) takeSchool(found, level, schoolWithLevel(match[1], level));
  }

  const stacked = plain.match(
    /Elementary(?:\s+School)?\s+([A-Z][A-Za-z0-9 .'/-]+?)\s+Middle(?:\s+School)?\s+([A-Z][A-Za-z0-9 .'/-]+?)\s+High(?:\s+School)?\s+([A-Z][A-Za-z0-9 .'/-]+)/
  );
  if (stacked) {
    takeSchool(found, "elementary", stacked[1]);
    takeSchool(found, "middle", stacked[2]);
    takeSchool(found, "high", stacked[3]);
  }

  for (const match of text.matchAll(/SchoolsListItem__heading[^>]*>([^<]+)<\/div>/gi)) {
    const raw = match[1].trim();
    if (/elementary/i.test(raw)) takeSchool(found, "elementary", raw);
    else if (/middle/i.test(raw)) takeSchool(found, "middle", raw);
    else if (/high/i.test(raw)) takeSchool(found, "high", raw);
  }

  for (const match of text.matchAll(
    /school-name">\s*([^<]+)\s*<\/div>[\s\S]{0,240}?school-data-grades">\s*([^<]+)/gi
  )) {
    const grades = match[2];
    const level = /9\s*-\s*12|9-12/i.test(grades)
      ? "high"
      : /6\s*-\s*8|6-8|7\s*-\s*8/i.test(grades)
        ? "middle"
        : /K\s*-\s*5|K-5|PK|1\s*-\s*5/i.test(grades)
          ? "elementary"
          : "";
    if (level) takeSchool(found, level, match[1]);
  }
}

function parseScriptJson(html) {
  const blobs: any[] = [];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const text = match[1].trim().replace(/^\)\]\}'?/, "").replace(/^\{\}&&/, "");
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        blobs.push(JSON.parse(text));
      } catch {
        // ignore
      }
    }
    const assigned = text.match(/(?:__NEXT_DATA__|__PRELOADED_STATE__)\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (assigned) {
      try {
        blobs.push(JSON.parse(assigned[1]));
      } catch {
        // ignore
      }
    }
  }
  return blobs;
}

function labeledPairs(html) {
  const pairs: any[] = [];
  const add = (label, value) => {
    const key = decode(label || "").replace(/\s+/g, " ").trim();
    const next = decode(value || "").replace(/\s+/g, " ").trim();
    if (key && next) pairs.push([key, next]);
  };
  for (const match of html.matchAll(/<dt[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>\s*([^<]+?)\s*<\/dd>/gi)) {
    add(match[1], match[2]);
  }
  for (const match of html.matchAll(/<strong>\s*([^<:]{3,40}):\s*<\/strong>\s*([^<]{1,80})/gi)) {
    add(match[1], match[2]);
  }
  for (const match of html.matchAll(/Association Fee:\s*<span>\s*([^<]+)/gi)) {
    add("Association Fee", match[1]);
  }
  return pairs;
}

function schoolWithLevel(value, level) {
  const name = String(value || "").trim();
  if (!name) return "";
  if (new RegExp(level, "i").test(name)) return name;
  if (level === "elementary") return `${name} Elementary`;
  if (level === "middle") return `${name} Middle`;
  return `${name} High`;
}

function scrapeLabeledPairs(html, found, options = {}) {
  const pairs = labeledPairs(html);
  const byLabel = {};
  for (const [label, value] of pairs) byLabel[label.toLowerCase()] = value;
  takeCommunity(found, byLabel.subdivision, true);
  takeFact(found, "beds", byLabel.bedrooms, true);
  const full = Number(byLabel["full baths"]);
  const half = Number(byLabel["half baths"]);
  if (Number.isFinite(full) && full > 0) takeFact(found, "baths", full + (Number.isFinite(half) ? half * 0.5 : 0), true);
  else takeFact(found, "baths", byLabel.bathrooms);
  takeFact(found, "sqft", byLabel["living area"] || byLabel["sq ft total"] || byLabel["total heated square feet"], true);
  if (byLabel["lot size area"]) takeFact(found, "lotAcres", byLabel["lot size area"], true);
  else if (byLabel["lot size"]) takeFact(found, "lotSqft", byLabel["lot size"]);
  if (byLabel["days on market"]) takeDom(found, byLabel["days on market"], "labeled");
  else if (byLabel["cumulative days on market"]) takeDom(found, byLabel["cumulative days on market"], "cumulative");
  const hoaText = byLabel["hoa fee"] || byLabel["association fee"] || byLabel["hoa fee paid"] || "";
  if (hoaText) {
    const hoa = hoaToMonthly(hoaText);
    if (hoa != null && hoa <= 2000) take(found, "hoa", hoa, "listed");
  }
  if (!options.skipTaxInsurance) {
    const taxLabel = pairs.find(([label]) => /property taxes/i.test(label));
    const taxValue = taxLabel?.[1] || byLabel["tax amount"] || byLabel["taxes"];
    if (taxValue) {
      const monthly = taxToMonthly(taxValue, found.price);
      if (monthly) take(found, "taxMonthly", monthly, "history");
    }
  }
  takeSchool(found, "elementary", schoolWithLevel(byLabel["elementary school"], "elementary"));
  takeSchool(found, "middle", schoolWithLevel(byLabel["middle school"], "middle"));
  takeSchool(found, "high", schoolWithLevel(byLabel["high school"], "high"));
  for (const match of html.matchAll(
    /(\d{1,2})\s*\/\s*10[\s\S]{0,120}?([A-Z][^<]{3,70}(?:Elementary|Middle|High)\s+School)/gi
  )) {
    const name = match[2];
    if (/elementary/i.test(name)) takeSchool(found, "elementary", name);
    else if (/middle/i.test(name)) takeSchool(found, "middle", name);
    else if (/high/i.test(name)) takeSchool(found, "high", name);
  }
}

function pageAddressOf(html) {
  const listedAddress = html.match(/"address"\s*:\s*"([^"]+\b(?:NC|SC|VA|MD|DC)\b[^"]*)"/i);
  return (
    streetAddress(readMeta(html, "og:street-address")) ||
    streetAddress(readMeta(html, "og:title") || readMeta(html, "twitter:title")) ||
    streetAddress(listedAddress?.[1])
  );
}

function addressConflicts(target, candidate) {
  if (!target || !candidate) return false;
  const current = addressKey(target);
  const incoming = addressKey(candidate);
  if (!current || !incoming || !/^\d/.test(current) || !/^\d/.test(incoming)) return false;
  return !sameAddress(current, incoming);
}

function applyPage(html, found, options = {}) {
  const pageAddress = pageAddressOf(html);
  if (addressConflicts(found.address, pageAddress)) return;
  found.facts ||= emptyFacts();
  for (const blob of parseScriptJson(html)) walkJson(blob, found, options);
  if (!options.skipTaxInsurance) scrapeRedfinCosts(html, found);
  scrapeLabeledFacts(html, found, options);
  scrapeFacts(html, found);
  scrapeLabeledPairs(html, found, options);
  if (pageAddress && (!found.address || pageAddress.length > found.address.length)) {
    found.address = pageAddress;
  }
  found.price ||= parsePrice(readMeta(html, "product:price:amount") || readMeta(html, "og:price:amount"));
  if (!found.price) {
    const listed = html.match(/["'](?:price|listPrice|list_price)["']\s*:\s*["']?([0-9]{5,9})/i);
    if (listed) found.price = parsePrice(listed[1]);
  }
  found.photo ||= listingPhoto(html);
  scrapeStatus(html, found);
}

function listingPhoto(html) {
  const raw = readMeta(html, "og:image") || readMeta(html, "twitter:image");
  if (!/^https?:\/\//i.test(raw)) return "";
  if (/logo|icon|sprite|avatar|default[-_]?photo/i.test(raw) && !/cdn-redfin|zillowstatic|photos\.zillow/i.test(raw)) {
    return "";
  }
  return raw;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const PREVIEW_HEADERS = {
  "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

const pageCache = new Map();

async function fetchPage(url) {
  const cached = pageCache.get(url);
  if (cached) return cached;
  const headerSets = /longandfoster\.com/i.test(url)
    ? [PREVIEW_HEADERS, BROWSER_HEADERS]
    : [BROWSER_HEADERS, PREVIEW_HEADERS];
  try {
    let result = { url, ok: false, status: 0, html: "" };
    for (const [index, headers] of headerSets.entries()) {
      const response = await fetch(url, { headers, redirect: "follow" });
      const html = await response.text();
      const challenged = isChallengeHtml(html);
      result = { url: response.url || url, ok: response.ok, status: response.status, html };
      const usable = response.ok && html.length > 8000 && !challenged;
      if (usable || index === headerSets.length - 1) break;
    }
    if (result.ok && result.html.length > 8000 && !isChallengeHtml(result.html)) pageCache.set(url, result);
    return result;
  } catch {
    return { url, ok: false, status: 0, html: "" };
  }
}

function mirrorUrls(address) {
  const parsed = parseAddress(address);
  const urls: any[] = [];
  const carolina = !parsed.state || parsed.state === "NC" || parsed.state === "SC";
  if (carolina && parsed.number && parsed.street && parsed.city) {
    const city = slugify(parsed.city);
    for (const street of streetSlugs(parsed.street)) {
      urls.push(`https://www.palmettopark.com/homes/${city}/${parsed.number}-${street}`);
    }
  }
  if (parsed.city && parsed.state) {
    urls.push(`https://www.coldwellbankerhomes.com/${parsed.state.toLowerCase()}/${slugify(parsed.city)}/`);
  }
  return [...new Set(urls)];
}

export function listingFromLongFoster(html, address) {
  const parsed = parseAddress(address);
  if (!parsed.number) return "";
  const street = parsed.street.replace(/\s+/g, "");
  const hrefs = [...html.matchAll(/href="([^"]*\/details\/\d+\/[^"]+)"/gi)].map((match) => match[1]);
  const matched = hrefs.find((href) => {
    const slug = href.match(/\/details\/\d+\/([^"?#]+)/i)?.[1]?.toLowerCase() || "";
    return slug.startsWith(`${String(parsed.number).toLowerCase()}-`) && looselyIncludes(href, street);
  });
  if (!matched) return "";
  const parts = matched.match(/\/details\/(\d+)\/([^"?#/]+)/i);
  if (!parts) return "";
  return `https://www.longandfoster.com/realestate/details/${parts[1]}/${parts[2]}`;
}

async function fillFromLongFoster(address, found) {
  const first = longFosterCityUrl(address);
  if (!first) return;
  for (let page = 1; page <= 8; page += 1) {
    const url = page === 1 ? first : `${first}/page-${page}`;
    const cityPage = await fetchPage(url);
    if (!cityPage.html || cityPage.html.length < 400 || isChallengeHtml(cityPage.html)) break;
    const detail = listingFromLongFoster(cityPage.html, address);
    if (detail) {
      const listing = await fetchPage(detail);
      if (listing.html && !isChallengeHtml(listing.html)) applyPage(listing.html, found);
      return;
    }
    if (!new RegExp(`/page-${page + 1}(?:["'?/]|$)`).test(cityPage.html)) break;
  }
}

export function listingFromCityPage(html, address, base) {
  const parsed = parseAddress(address);
  if (!parsed.number) return "";
  const hrefs = [...html.matchAll(/href="(\/[^"]*\/pid_\d+\/)"/gi)].map((match) => match[1]);
  const numbered = hrefs.filter((href) => href.includes(parsed.number));
  const street = parsed.street.replace(/\s+/g, "");
  const matched = numbered.find((href) => looselyIncludes(href, street)) || "";
  if (!matched) return "";
  try {
    return new URL(matched, base).href;
  } catch {
    return "";
  }
}

function insuranceEstimate(price) {
  if (!price) return null;
  return Math.round((price * 0.0026) / 12);
}

export function extractListingFacts(html, found = {}) {
  const next = {
    address: found.address || "",
    price: found.price || 0,
    taxMonthly: found.taxMonthly ?? null,
    hoa: found.hoa ?? null,
    insuranceMonthly: found.insuranceMonthly ?? null,
    schools: found.schools || {},
    facts: found.facts || emptyFacts(),
    photo: found.photo || "",
    taxMonthlyRank: found.taxMonthlyRank || 0,
    hoaRank: found.hoaRank || 0,
    insuranceMonthlyRank: found.insuranceMonthlyRank || 0,
  };
  applyPage(html, next);
  return next;
}

function schoolLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || "";
}

function hasSchools(schools) {
  return Boolean(schoolLabel(schools?.elementary) || schoolLabel(schools?.middle) || schoolLabel(schools?.high));
}

export async function pullListing(url, options = {}) {
  const fromUrl = addressFromUrl(url);
  const found = {
    address: streetAddress(options.addressHint) || fromUrl,
    price: 0,
    taxMonthly: null,
    hoa: null,
    insuranceMonthly: null,
    schools: {},
    facts: emptyFacts(),
    photo: "",
  };

  const primary = await fetchPage(url);
  const challenge = isChallengeHtml(primary.html);
  if (primary.html && !challenge) applyPage(primary.html, found);

  const failed =
    challenge ||
    !primary.ok ||
    primary.html.length < 400 ||
    !found.price ||
    !streetAddress(found.address || fromUrl);

  let mls = mlsFromUrl(url) || (!challenge ? mlsFromHtml(primary.html) : "");
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  const portal = /redfin|zillow|realtor|terravista/.test(host);
  const needMirrors =
    failed ||
    portal ||
    Boolean(mls) ||
    found.taxMonthly == null ||
    found.taxMonthlySource === "estimate" ||
    found.hoa == null ||
    found.hoaSource === "estimate" ||
    found.insuranceMonthly == null;

  let sourceUrl = preferListingUrl("", primary.url || url);
  if (needMirrors) {
    const seen = new Set();
    const extras = [
      ...zillowMirrorUrls(found.address || fromUrl),
      ...mirrorUrls(found.address || fromUrl),
      ...mlsMirrorUrls(mls),
    ];
    const pages = await Promise.all(extras.map(fetchPage));
    for (const page of pages) {
      if (!page.ok || page.html.length < 400 || isChallengeHtml(page.html) || seen.has(page.url)) continue;
      seen.add(page.url);
      const zillowUrl = zillowDetailUrl(page.html, page.url);
      if (zillowUrl && zillowUrl !== page.url && !seen.has(zillowUrl)) {
        seen.add(zillowUrl);
        const detail = await fetchPage(zillowUrl);
        if (detail.html && !isChallengeHtml(detail.html)) {
          applyPage(detail.html, found);
          sourceUrl = preferListingUrl(sourceUrl, zillowUrl);
          if (!mls) mls = mlsFromHtml(detail.html);
          continue;
        }
      } else if (zillowUrl) {
        sourceUrl = preferListingUrl(sourceUrl, zillowUrl);
        applyPage(page.html, found);
        if (!mls) mls = mlsFromHtml(page.html);
        continue;
      }
      if (/coldwellbankerhomes\.com\/[a-z]{2}\//i.test(page.url) && !/\/pid_/.test(page.url)) {
        const detail = listingFromCityPage(page.html, found.address || fromUrl, page.url);
        if (detail && detail !== page.url) {
          const listing = await fetchPage(detail);
          if (listing.html && !isChallengeHtml(listing.html)) {
            applyPage(listing.html, found, { skipTaxInsurance: /palmettopark/.test(listing.url) });
            if (!mls) mls = mlsFromHtml(listing.html);
            sourceUrl = preferListingUrl(sourceUrl, listing.url);
          }
        }
        continue;
      }
      applyPage(page.html, found, { skipTaxInsurance: /palmettopark/.test(page.url) });
      if (!mls) mls = mlsFromHtml(page.html);
      sourceUrl = preferListingUrl(sourceUrl, page.url);
    }
    const fallback = mlsMirrorUrls(mls)[0];
    if (failed && fallback && !seen.has(fallback)) {
      const page = await fetchPage(fallback);
      if (page.ok && page.html.length > 400 && !isChallengeHtml(page.html)) {
        applyPage(page.html, found);
        sourceUrl = preferListingUrl(sourceUrl, page.url);
      }
    }
  }

  sourceUrl = preferListingUrl(sourceUrl, zillowMirrorUrls(found.address || fromUrl)[0]);

  if (!found.price || found.taxMonthly == null || found.hoa == null || !hasSchools(found.schools)) {
    await fillFromLongFoster(found.address || fromUrl, found);
  }

  if (found.insuranceMonthly == null && found.price && (found.taxMonthly != null || found.hoa != null)) {
    take(found, "insuranceMonthly", insuranceEstimate(found.price), "estimate");
  }

  const blocked = challenge || !primary.ok || primary.html.length < 400;
  return {
    name: streetAddress(found.address) || fromUrl,
    url: preferListingUrl(url, sourceUrl),
    price: found.price,
    taxMonthly: found.taxMonthly,
    hoa: found.hoa,
    insuranceMonthly: found.insuranceMonthly,
    facts: found.facts || emptyFacts(),
    photo: found.photo || "",
    schools: hasSchools(found.schools)
      ? await decorateSchools(found.schools, found.address || fromUrl)
      : null,
    blocked,
    status: found.status || "",
    unavailable: false,
  };
}

export async function refreshRedfinListing(house: any): Promise<any> {
  if (!house?.url) return { ok: false };
  try {
    const listing = await pullListing(house.url, { addressHint: house.name });
    return {
      ok: true,
      ...listing,
      unavailable: false,
    };
  } catch {
    return { ok: false };
  }
}

export async function findSchools(address) {
  const found = { address: cleanAddress(address), schools: {} };
  if (!found.address) return null;
  const pages = await Promise.all([...zillowMirrorUrls(found.address), ...mirrorUrls(found.address)].map(fetchPage));
  for (const page of pages) {
    if (!page.ok || page.html.length < 400) continue;
    if (/\/pid_/.test(page.url) === false && /coldwellbankerhomes\.com\/[a-z]{2}\//i.test(page.url)) {
      const detail = listingFromCityPage(page.html, found.address, page.url);
      if (detail && detail !== page.url) {
        const listing = await fetchPage(detail);
        if (listing.html) applyPage(listing.html, found);
        continue;
      }
    }
    applyPage(page.html, found);
  }
  if (!hasSchools(found.schools)) await fillFromLongFoster(found.address, found);
  if (!hasSchools(found.schools)) return null;
  return decorateSchools(found.schools, found.address);
}
