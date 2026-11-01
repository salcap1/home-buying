"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  analyzeHouse,
  defaultDown,
  expenseTotal,
  saleFigures,
  type HouseAnalysis,
} from "@/lib/calc";
import { addressKey, listingLabel, sameAddress, unavailableReason } from "@/lib/redfin-csv";
import { ChevronDown, ChevronUp, ExternalLink, Heart, X } from "lucide-react";
import { getBrand } from "@/lib/brand";
import { money, moneyFine } from "@/lib/format";
import type {
  Assumptions,
  Destination,
  DriveTime,
  ExtraItem,
  Facts,
  House,
  MapPin,
  School,
  SchoolDistrict,
  Schools,
} from "@/lib/types";
import { EMPTY_FACTS, EMPTY_SCHOOL, EMPTY_SCHOOLS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AuthPanel, type AuthMode } from "@/components/AuthPanel";
import ListingMap from "./ListingMap";
import OverviewMap from "./OverviewMap";

const brand = getBrand();

const EMPTY_DESTINATIONS: Destination[] = [];

const OVERVIEW = "overview";

type SortKey = "price" | "sqft" | "lot" | "housing" | "gap" | "drive" | "community";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };
type Trip = DriveTime & { id: string };
type SearchMapView = {
  pins: MapPin[];
  districts: SchoolDistrict[];
  places: Destination[];
  area: { lat: number; lng: number; radiusMiles: number } | null;
};

function isDraft(item?: (Pick<House, "id"> & { draft?: boolean }) | null) {
  return Boolean(item?.draft || String(item?.id || "").startsWith("draft-"));
}

function blankHouse(): House & { draft: true } {
  return {
    id: `draft-${crypto.randomUUID()}`,
    name: "",
    url: "",
    price: 0,
    downDollars: 0,
    rate: 6.5,
    insuranceMonthly: 0,
    taxMonthly: null,
    hoa: 0,
    updateCash: 0,
    extraItems: [],
    lat: null,
    lng: null,
    schools: EMPTY_SCHOOLS,
    facts: EMPTY_FACTS,
    photo: "",
    notes: "",
    hearted: false,
    sortOrder: 9999,
    draft: true,
  };
}

function lotSqft(facts?: Facts | null) {
  if (facts?.lotAcres) return Number(facts.lotAcres) * 43560;
  if (facts?.lotSqft) return Number(facts.lotSqft);
  return null;
}

function shortName(name?: string | null) {
  return (
    String(name || "")
      .split(",")[0]
      .trim() ||
    name ||
    ""
  );
}

function matchesStreet(house: House, query: string) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return true;
  return (
    shortName(house?.name).toLowerCase().includes(q) ||
    String(house?.facts?.community || "")
      .toLowerCase()
      .includes(q) ||
    String(house?.facts?.district || "")
      .toLowerCase()
      .includes(q)
  );
}

function parseFactNumber(value: string) {
  if (String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function lotAcresInput(facts?: Facts | null) {
  if (facts?.lotAcres != null) return facts.lotAcres;
  if (facts?.lotSqft != null) return Math.round((Number(facts.lotSqft) / 43560) * 1000) / 1000;
  return "";
}

function lotLabel(facts?: Facts | null) {
  if (facts?.lotAcres) return `${Number(facts.lotAcres)} ac`;
  if (facts?.lotSqft && facts.lotSqft >= 4000) return `${(facts.lotSqft / 43560).toFixed(2)} ac`;
  if (facts?.lotSqft) return `${Number(facts.lotSqft).toLocaleString()} sf`;
  return "—";
}

const SORT_DEFAULTS: Record<SortKey, SortDir> = {
  price: "desc",
  sqft: "desc",
  lot: "desc",
  housing: "asc",
  gap: "desc",
  drive: "asc",
  community: "asc",
};

function sortValue(
  key: SortKey,
  item: House,
  row: HouseAnalysis,
  driveTimes: Record<string, DriveTime>
) {
  if (key === "price") return item.price || null;
  if (key === "sqft") return item.facts?.sqft || null;
  if (key === "lot") return lotSqft(item.facts);
  if (key === "community") return String(item.facts?.community || "").toLowerCase() || null;
  if (key === "housing") return row.housing || null;
  if (key === "gap") return row.gap;
  if (key === "drive") {
    const trip = driveTimes[item.id];
    if (trip?.minutes != null) return trip.minutes;
    if (trip?.miles != null) return trip.miles;
    return null;
  }
  return null;
}

function SortTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={`sort-btn${active ? " active" : ""} -ml-2`}
        title={`Sort by ${label}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className={`sort-arrow${active ? ` ${sort.dir}` : ""}`} aria-hidden="true">
          <ChevronUp className="up" size={10} strokeWidth={2.5} />
          <ChevronDown className="down" size={10} strokeWidth={2.5} />
        </span>
      </Button>
    </TableHead>
  );
}

function paymentPin(housing?: number | null) {
  if (!housing) return "•";
  return money(Math.round(housing));
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function preferPrice(scraped?: number | null, current?: number | null) {
  if (!scraped) return current || 0;
  if (!current) return scraped;
  const ratio = scraped / current;
  if (ratio < 0.75 || ratio > 1.35) return current;
  return scraped;
}

function preferName(scraped?: string | null, current?: string | null) {
  if (!scraped) return current || "";
  if (!current || !/^\d+\s+[A-Za-z]/.test(current)) return scraped;
  const left = addressKey(current);
  const right = addressKey(scraped);
  if (left && right && sameAddress(left, right)) return scraped;
  return current;
}

function nameList(items: { name?: string | null }[]) {
  const names = items.map((item) => listingLabel(item));
  if (names.length <= 6) return names.join(", ");
  return `${names.slice(0, 6).join(", ")}, and ${names.length - 6} more`;
}

function importSummary(result: {
  incoming?: number;
  added?: number;
  updated?: number;
  skipped?: number;
  dismissed?: { name?: string | null }[];
  unavailable?: { name?: string | null; reason?: string; removed?: boolean }[];
  outside?: { name?: string | null }[];
}) {
  const incoming = result.incoming ?? 0;
  const added = result.added ?? 0;
  const dismissed = result.dismissed || [];
  const unavailable = result.unavailable || [];
  const outside = result.outside || [];
  const lines = [
    `File had ${incoming} listing${incoming === 1 ? "" : "s"}. Added ${added}${result.updated ? `, updated ${result.updated} price${result.updated === 1 ? "" : "s"}` : ""
    }${result.skipped ? `, ${result.skipped} already on the board` : ""}.`,
  ];
  if (dismissed.length) {
    lines.push(
      `${dismissed.length} already added and then deleted: ${nameList(dismissed)}. They were not added.`
    );
  }
  if (outside.length) {
    lines.push(
      `${outside.length} outside this search area: ${nameList(outside)}. They were not added.`
    );
  }
  if (unavailable.length) {
    const removed = unavailable.filter((item) => item.removed);
    const blocked = unavailable.filter((item) => !item.removed);
    if (blocked.length) {
      const sample = blocked[0]?.reason || "no longer available";
      const mixed = blocked.some((item) => item.reason && item.reason !== sample);
      lines.push(
        `${blocked.length} ${mixed ? "off the market" : sample}: ${nameList(blocked)}. They were not added.`
      );
    }
    if (removed.length) {
      lines.push(
        `${removed.length} already on the board went off the market and ${removed.length === 1 ? "was" : "were"
        } removed: ${nameList(removed)}.`
      );
    }
  }
  return lines.join(" ");
}

function pinLooksLocal(point: { lat?: number | null; lng?: number | null } | null | undefined) {
  return point?.lat != null && point?.lng != null;
}

function nameLooksLikeAddress(name?: string | null) {
  const text = String(name || "").trim();
  return /^\d+\s+[A-Za-z]/.test(text) && !/^house\s+\d+$/i.test(text);
}

function schoolMarks(schools?: Schools | null) {
  return (["elementary", "middle", "high"] as const)
    .map((key) => {
      const school = schools?.[key];
      if (!school?.name) return "—";
      return school.rating != null ? String(school.rating) : "?";
    })
    .join(" / ");
}

const SCHOOL_TIP = [
  ["elementary", "Elem"],
  ["middle", "Mid"],
  ["high", "High"],
] as const;

function schoolTip(schools?: Schools | null) {
  const rows = SCHOOL_TIP.map(([key, label]) => {
    const school = schools?.[key];
    const name = school?.name || "—";
    const rating = school?.rating != null ? String(school.rating) : "—";
    const tone =
      school?.rating != null && school.rating >= 8
        ? " good"
        : school?.rating != null && school.rating < 5
          ? " poor"
          : "";
    return `<div class="tip-school"><span class="tip-school-level">${label}</span><span class="tip-school-name">${escapeHtml(name)}</span><span class="tip-school-rating${tone}">${rating}</span></div>`;
  });
  return `<div class="tip-schools">${rows.join("")}</div>`;
}

function IconButton({
  kind,
  on = false,
  href,
  onClick,
  label,
  title,
}: {
  kind: string;
  on?: boolean;
  href?: string;
  onClick?: (event: MouseEvent) => void;
  label: string;
  title?: string;
}) {
  const className = `icon-btn${kind === "heart" && on ? " on" : ""}`;
  const icon =
    kind === "heart" ? (
      <Heart size={16} strokeWidth={1.75} fill={on ? "currentColor" : "none"} />
    ) : kind === "listing" ? (
      <ExternalLink size={16} strokeWidth={1.75} />
    ) : (
      <X size={16} strokeWidth={1.75} />
    );

  if (href) {
    return (
      <Button variant="ghost" size="icon-sm" asChild className={className}>
        <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={title || label}>
          {icon}
        </a>
      </Button>
    );
  }
  return (
    <Button
      className={className}
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-pressed={kind === "heart" ? on : undefined}
      aria-label={label}
      title={title || label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}

function ListingIcon({ href }: { href?: string | null }) {
  if (!href) return null;
  return <IconButton kind="listing" href={href} label="Open listing" />;
}

const SIGNED_AMOUNT = /^-?\d*\.?\d*$/;

function SignedAmount({ value, onChange }: { value: number; onChange: (amount: number) => void }) {
  const [text, setText] = useState(() => String(value ?? 0));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value ?? 0));
  }, [value]);

  return (
    <Input
      inputMode="decimal"
      value={text}
      aria-label="Amount"
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        const n = Number(text);
        const amount = text.trim() === "" || !Number.isFinite(n) ? 0 : n;
        onChange(amount);
        setText(String(amount));
      }}
      onChange={(event) => {
        const next = event.target.value.replace(/[$,\s]/g, "");
        if (!SIGNED_AMOUNT.test(next)) return;
        setText(next);
        if (next === "" || next === "-" || next === "." || next === "-.") return;
        const n = Number(next);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  computed,
  total,
  text,
  result,
  compact,
}: {
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  prefix?: string;
  suffix?: string;
  computed?: boolean;
  total?: boolean;
  text?: boolean;
  result?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`field${computed ? " computed" : ""}${total ? " total" : ""}${text ? " text-field" : ""}${result ? " with-result" : ""}`}
    >
      <Label>{label}</Label>
      {computed ? (
        <div className="out">{value}</div>
      ) : (
        <>
          <div className="control">
            {prefix ? <span className="suffix">{prefix}</span> : null}
            <Input
              value={value}
              inputMode={text ? "text" : "decimal"}
              className={text ? "min-w-[12ch]" : compact ? "w-full text-right" : "w-28 text-right"}
              onChange={(e) => onChange?.(e.target.value)}
            />
            {suffix ? <span className="suffix">{suffix}</span> : null}
          </div>
          {result ? <div className="out">{result}</div> : null}
        </>
      )}
    </div>
  );
}

export default function Page() {
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [activeId, setActiveId] = useState("");
  const [status, setStatus] = useState("");
  const [statusAlert, setStatusAlert] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [driveTimes, setDriveTimes] = useState<Record<string, DriveTime>>({});
  const [sort, setSort] = useState<SortState>({ key: "price", dir: "desc" });
  const [streetQuery, setStreetQuery] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importAlert, setImportAlert] = useState(false);
  const [hoverId, setHoverId] = useState("");
  const [districtsByBoard, setDistrictsByBoard] = useState<Record<string, SchoolDistrict[]>>({});
  const [boardMeta, setBoardMeta] = useState<{
    id: string;
    name: string;
    zip: string;
    radiusMiles: number;
    centerLat: number | null;
    centerLng: number | null;
  } | null>(null);
  const [boardId, setBoardId] = useState("");
  const [loadedBoardId, setLoadedBoardId] = useState("");
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [unlockError, setUnlockError] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [mapViews, setMapViews] = useState<Record<string, SearchMapView>>({});
  const [boardName, setBoardName] = useState("");
  const schoolLookup = useRef(new Set<string>());
  const schoolRefresh = useRef(false);
  const pulling = useRef(false);
  const importing = useRef(false);
  const persistTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const locatingPlaces = useRef(new Set<string>());
  const assumptionsRef = useRef<Assumptions | null>(null);
  const writableBoard = useRef("");
  const boardNameFocused = useRef(false);
  const mapSigRef = useRef<Record<string, string>>({});
  const urlBox = useRef<HTMLInputElement>(null);
  const importBox = useRef<HTMLInputElement>(null);

  const blankAssumptions = (): Assumptions => ({
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
  });

  useEffect(() => {
    let cancelled = false;
    const requested = boardId;
    schoolRefresh.current = false;
    writableBoard.current = "";
    locatingPlaces.current.clear();
    setLoadedBoardId("");
    setSessionReady(false);
    fetch("/api/session")
      .then((r) => r.json())
      .then(async (session) => {
        if (cancelled) return;
        if (!session.unlocked) {
          setUnlocked(false);
          setBoardMeta(null);
          setBoardId("");
          assumptionsRef.current = blankAssumptions();
          setAssumptions(blankAssumptions());
          setHouses([]);
          setLoadedBoardId("");
          setActiveId(OVERVIEW);
          setSessionReady(true);
          return;
        }
        setUnlocked(true);
        setBoardMeta(session.board || session.boards?.[0] || null);
        setBoardId(session.boardId || session.board?.id || "");
        const [nextAssumptions, nextHouses] = await Promise.all([
          fetch("/api/assumptions").then((r) => r.json()),
          fetch("/api/houses").then((r) => r.json()),
        ]);
        if (cancelled || (session.boardId || "") !== requested) {
          if (!cancelled && requested === "" && session.boardId) {
            setSessionReady(true);
          }
          return;
        }
        writableBoard.current = requested;
        assumptionsRef.current = nextAssumptions;
        setAssumptions(nextAssumptions);
        setHouses(Array.isArray(nextHouses) ? nextHouses : []);
        setLoadedBoardId(requested);
        setActiveId(OVERVIEW);
        setSessionReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setUnlocked(false);
        setAssumptions((current) => current || blankAssumptions());
        setHouses([]);
        setLoadedBoardId("");
        setActiveId(OVERVIEW);
        setSessionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const activeTab = boardMeta && boardMeta.id === boardId ? boardMeta : boardMeta;
  const searchArea =
    activeTab?.centerLat != null && activeTab.centerLng != null
      ? {
        lat: activeTab.centerLat,
        lng: activeTab.centerLng,
        radiusMiles: activeTab.radiusMiles || 20,
      }
      : null;

  useEffect(() => {
    if (!boardNameFocused.current) setBoardName(activeTab?.name || "");
  }, [activeTab?.id, activeTab?.name]);

  const showingOverview = activeId === OVERVIEW;
  const house = showingOverview ? null : houses.find((item) => item.id === activeId) || null;
  const destinations = assumptions?.destinations || EMPTY_DESTINATIONS;
  const destinationKey = destinations.map((item) => `${item.id}:${item.lat}:${item.lng}`).join("|");
  const commute = destinations[0] || null;
  const houseGeoKey = houses.map((item) => `${item.id}:${item.lat}:${item.lng}`).join("|");
  const analysis = useMemo(
    () => (house && assumptions ? analyzeHouse(house, assumptions) : null),
    [house, assumptions]
  );
  const sale = assumptions ? saleFigures(assumptions) : null;
  const overviewRows = useMemo(
    () =>
      assumptions
        ? houses
          .filter((item) => !isDraft(item))
          .map((item) => ({ house: item, analysis: analyzeHouse(item, assumptions) }))
        : [],
    [houses, assumptions]
  );
  const sortedRows = useMemo(() => {
    if (!sort.key) return overviewRows;
    return [...overviewRows].sort((a, b) => {
      const heart = Number(Boolean(b.house.hearted)) - Number(Boolean(a.house.hearted));
      if (heart) return heart;
      const av = sortValue(sort.key, a.house, a.analysis, driveTimes);
      const bv = sortValue(sort.key, b.house, b.analysis, driveTimes);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        const cmp = String(av).localeCompare(String(bv));
        return sort.dir === "asc" ? cmp : -cmp;
      }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [overviewRows, sort, driveTimes]);
  const visibleRows = useMemo(() => {
    if (!streetQuery.trim()) return sortedRows;
    return sortedRows.filter(({ house: item }) => matchesStreet(item, streetQuery));
  }, [sortedRows, streetQuery]);

  const mapPins = useMemo(
    () =>
      overviewRows.flatMap(({ house: item, analysis: row }) => {
        if (item.lat == null || item.lng == null) return [];
        const rooms = `${item.facts?.beds || "—"} / ${item.facts?.baths || "—"}`;
        const sqft = item.facts?.sqft ? `${Number(item.facts.sqft).toLocaleString()} sq ft` : "—";
        const gap = `${money(row.gap)} difference`;
        const commuteLabel =
          driveTimes[item.id]?.minutes != null
            ? `${driveTimes[item.id].minutes} min ${commute?.name || "drive"}`
            : "";
        return [
          {
            id: item.id,
            lat: item.lat,
            lng: item.lng,
            photo: item.photo || "",
            schools: schoolMarks(item.schools),
            label: paymentPin(row.housing),
            html: `${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="">` : ""}<strong>${escapeHtml(item.name)}</strong>${item.facts?.community ? `<span class="tip-community">${escapeHtml(item.facts.community)}</span>` : ""}${item.facts?.district ? `<span class="tip-community">${escapeHtml(item.facts.district)}</span>` : ""}<div class="tip-metrics"><span>${money(item.price)}</span><span>${rooms} · ${sqft}</span><span>${money(row.housing)} / mo · ${gap}</span><span>${commuteLabel || "—"}</span></div>${schoolTip(item.schools)}`,
          },
        ];
      }),
    [overviewRows, driveTimes, commute?.name]
  );
  const mapPlaces = useMemo(
    () =>
      destinations
        .filter((place) => place.lat != null && place.lng != null)
        .map((place) => ({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          name: place.name || "Place",
          address: place.address || "",
        })),
    [destinations]
  );

  useEffect(() => {
    if (
      !boardId ||
      loadedBoardId !== boardId ||
      !Object.prototype.hasOwnProperty.call(districtsByBoard, boardId)
    )
      return;
    const districtList = districtsByBoard[boardId] || [];
    const signature = [
      mapPins
        .map(
          (pin) =>
            `${pin.id}:${pin.lat}:${pin.lng}:${pin.label}:${pin.schools || ""}:${pin.html.length}`
        )
        .join("|"),
      districtList.map((district) => district.geoid).join("|"),
      mapPlaces.map((place) => `${place.id}:${place.lat}:${place.lng}:${place.name}`).join("|"),
      searchArea ? `${searchArea.lat}:${searchArea.lng}:${searchArea.radiusMiles}` : "",
    ].join("||");
    if (mapSigRef.current[boardId] === signature) return;
    mapSigRef.current[boardId] = signature;
    setMapViews((current) => ({
      ...current,
      [boardId]: {
        pins: mapPins,
        districts: districtList,
        places: mapPlaces,
        area: searchArea,
      },
    }));
  }, [
    boardId,
    loadedBoardId,
    districtsByBoard,
    mapPins,
    mapPlaces,
    searchArea,
  ]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: SORT_DEFAULTS[key] }
    );
  }

  useEffect(() => {
    if (!house || !nameLooksLikeAddress(house.name) || pinLooksLocal(house)) return undefined;
    let cancelled = false;
    locateAddress(house.name).then((coords) => {
      if (cancelled || !coords) return;
      const patch: Partial<House> = { lat: coords.lat, lng: coords.lng };
      if (coords.districtGeoid) {
        patch.facts = {
          ...house.facts,
          district: coords.district || "",
          districtGeoid: coords.districtGeoid,
        };
      }
      updateHouse(patch, house);
    });
    return () => {
      cancelled = true;
    };
  }, [house?.id, house?.name, house?.lat]);

  useEffect(() => {
    const places = destinations.filter((item) => item.lat != null);
    if (!house?.lat || !places.length) {
      setTrips((current) => (current.length ? [] : current));
      return undefined;
    }
    let cancelled = false;
    fetch("/api/geo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lat: house.lat, lng: house.lng },
        destinations: places,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTrips(data.distances || []);
      });
    return () => {
      cancelled = true;
    };
  }, [house?.id, house?.lat, house?.lng, destinationKey]);

  useEffect(() => {
    if (!showingOverview) return undefined;
    if (commute?.lat == null || loadedBoardId !== boardId) {
      setDriveTimes((current) => (Object.keys(current).length ? {} : current));
      return undefined;
    }
    const origins = houses.filter((item) => item.lat != null);
    if (!origins.length) {
      setDriveTimes((current) => (Object.keys(current).length ? {} : current));
      return undefined;
    }
    const controller = new AbortController();
    fetch("/api/geo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        origins: origins.map((item) => ({ id: item.id, lat: item.lat, lng: item.lng })),
        destinations: [{ id: commute.id, lat: commute.lat, lng: commute.lng }],
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const pairs = (data.results || []).map((row: { id: string; distances?: DriveTime[] }) => [
          row.id,
          row.distances?.[0] || null,
        ]);
        setDriveTimes(Object.fromEntries(pairs));
      })
      .catch(() => { });
    return () => controller.abort();
  }, [
    showingOverview,
    houseGeoKey,
    commute?.id,
    commute?.lat,
    commute?.lng,
    boardId,
    loadedBoardId,
  ]);

  useEffect(() => {
    if (!showingOverview || loadedBoardId !== boardId) return undefined;
    const requested = boardId;
    const payload = houses
      .filter((item) => item.lat != null && item.lng != null)
      .map((item) => ({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        district: item.facts?.district || "",
        districtGeoid: item.facts?.districtGeoid || "",
      }));
    if (!payload.length) {
      setDistrictsByBoard((current) => ({ ...current, [requested]: [] }));
      return undefined;
    }
    setDistrictsByBoard((current) => (requested in current ? current : { ...current, [requested]: [] }));
    let cancelled = false;
    fetch("/api/districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houses: payload }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setDistrictsByBoard((current) => ({ ...current, [requested]: data.districts || [] }));
        const assignments = data.assignments || {};
        setHouses((current) =>
          current.map((item) => {
            const next = assignments[item.id];
            if (!next || item.facts?.districtGeoid === next.geoid) return item;
            return {
              ...item,
              facts: { ...item.facts, district: next.name, districtGeoid: next.geoid },
            };
          })
        );
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [showingOverview, houseGeoKey, loadedBoardId, boardId]);

  useEffect(() => {
    if (!showingOverview || schoolRefresh.current || !houses.length) return undefined;
    const needs = houses.some((item) =>
      ["elementary", "middle", "high"].some(
        (key) => item.schools?.[key]?.name && item.schools?.[key]?.rating == null
      )
    );
    if (!needs) return undefined;
    schoolRefresh.current = true;
    let cancelled = false;
    fetch("/api/schools/refresh", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (!cancelled && result?.houses?.length) setHouses(result.houses);
      })
      .catch(() => {
        schoolRefresh.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [showingOverview, houses]);

  useEffect(() => {
    if (!showingOverview) return undefined;
    let cancelled = false;
    async function fillPhotos() {
      while (!cancelled) {
        const result = await fetch("/api/houses/photos", { method: "POST" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cancelled || !result) break;
        if (result.updated?.length) {
          setHouses((current) => {
            const byId = new Map(current.map((item) => [item.id, item]));
            for (const item of result.updated) byId.set(item.id, { ...byId.get(item.id), ...item });
            return [...byId.values()];
          });
        }
        if (!result.remaining) break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    async function fillCosts() {
      while (!cancelled) {
        const result = await fetch("/api/houses/costs", { method: "POST" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cancelled || !result) break;
        if (result.updated?.length) {
          setHouses((current) => {
            const byId = new Map(current.map((item) => [item.id, item]));
            for (const item of result.updated) byId.set(item.id, { ...byId.get(item.id), ...item });
            return [...byId.values()];
          });
        }
        if (!result.remaining) break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    async function fillFacts() {
      while (!cancelled) {
        const result = await fetch("/api/houses/facts", { method: "POST" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cancelled || !result) break;
        if (result.updated?.length) {
          setHouses((current) => {
            const byId = new Map(current.map((item) => [item.id, item]));
            for (const item of result.updated) byId.set(item.id, { ...byId.get(item.id), ...item });
            return [...byId.values()];
          });
        }
        if (!result.remaining) break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    async function locateSchools() {
      while (!cancelled) {
        const result = await fetch("/api/schools/locate", { method: "POST" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (cancelled || !result) break;
        if (result.updated?.length) {
          setHouses((current) => {
            const byId = new Map(current.map((item) => [item.id, item]));
            for (const item of result.updated) byId.set(item.id, { ...byId.get(item.id), ...item });
            return [...byId.values()];
          });
        }
        if (!result.remaining) break;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    fillPhotos();
    fillCosts();
    fillFacts();
    locateSchools();
    return () => {
      cancelled = true;
    };
  }, [showingOverview]);

  useEffect(() => {
    if (!house?.id || isDraft(house)) return undefined;
    const hasName = ["elementary", "middle", "high"].some((key) => house.schools?.[key]?.name);
    const needsRating = ["elementary", "middle", "high"].some(
      (key) => house.schools?.[key]?.name && house.schools?.[key]?.rating == null
    );
    if (!house.name && !house.url) return undefined;
    if (hasName && !needsRating) return undefined;
    if (schoolLookup.current.has(house.id)) return undefined;

    let cancelled = false;
    schoolLookup.current.add(house.id);
    fetch("/api/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: house.name,
        url: hasName ? undefined : house.url,
        schools: hasName ? house.schools : undefined,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((schools) => {
        if (!cancelled && schools) updateHouse({ schools }, house);
      });
    return () => {
      cancelled = true;
    };
  }, [house?.id, house?.name, house?.url, house?.schools]);

  function persistAssumptions(next: Assumptions) {
    const board = writableBoard.current;
    const previous = assumptionsRef.current;
    if (!board || !previous) return;
    const cashChanged = (
      [
        "salePrice",
        "payoff",
        "extraCash",
        "closingPct",
        "keepCash",
        "listingAgentPct",
        "buyerAgentPct",
      ] as const
    ).some((key) => Number(next[key]) !== Number(previous[key]));
    assumptionsRef.current = next;
    setAssumptions(next);
    if (cashChanged) {
      setHouses((current) =>
        current.map((item) => ({
          ...item,
          downDollars: defaultDown(item.price, next, item.updateCash),
        }))
      );
    }
    fetch("/api/assumptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...next,
        boardId: board,
        rate: Number(next.rate) || 0,
      }),
    });
  }

  function updateAssumption(key: keyof Assumptions, value: string | number) {
    const current = assumptionsRef.current;
    if (!current) return;
    const blank = value === "" || value == null;
    const agent = key === "listingAgentPct" || key === "buyerAgentPct";
    persistAssumptions({
      ...current,
      [key]: key === "rate" ? value : blank && agent ? null : Number(value) || 0,
    });
  }

  function updateAssumptions(patch: Partial<Assumptions>) {
    const current = assumptionsRef.current;
    if (!current) return;
    persistAssumptions({ ...current, ...patch });
  }

  function updateFacts(patch: Partial<Facts>, target: House | null = house) {
    updateHouse({ facts: patch }, target);
  }

  function updateHouse(
    patch: Partial<Omit<House, "facts">> & { facts?: Partial<Facts> },
    target: House | null = house
  ) {
    if (!target?.id) return;
    setHouses((current) => {
      const prev = current.find((item) => item.id === target.id) || target;
      const nextHouse = {
        ...prev,
        ...patch,
        facts: patch.facts ? { ...EMPTY_FACTS, ...prev.facts, ...patch.facts } : prev.facts,
      };
      if (("price" in patch || "updateCash" in patch) && !("downDollars" in patch) && assumptions) {
        nextHouse.downDollars = defaultDown(nextHouse.price, assumptions, nextHouse.updateCash);
      }
      if (!isDraft(nextHouse)) {
        clearTimeout(persistTimers.current[target.id]);
        persistTimers.current[target.id] = setTimeout(() => {
          fetch(`/api/houses/${target.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextHouse),
          });
        }, 250);
      }
      return current.map((item) => (item.id === target.id ? nextHouse : item));
    });
  }

  function addExtra() {
    updateAssumptions({
      extraItems: [
        ...(assumptions?.extraItems || []),
        { id: crypto.randomUUID(), label: "", amount: 0, enabled: true },
      ],
    });
  }

  function updateExtra(id: string, patch: Partial<ExtraItem>) {
    updateAssumptions({
      extraItems: (assumptions?.extraItems || []).map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  }

  function removeExtra(id: string) {
    updateAssumptions({
      extraItems: (assumptions?.extraItems || []).filter((item) => item.id !== id),
    });
  }

  async function locateAddress(address?: string | null, name = "") {
    const queries = [
      ...new Set(
        [address, name && address ? `${name}, ${address}` : "", name]
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      ),
    ];
    if (!queries.length) return null;
    const geo = await fetch("/api/geo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: queries }),
    }).then((r) => r.json());
    return geo.lat != null
      ? {
        lat: geo.lat,
        lng: geo.lng,
        district: geo.district || "",
        districtGeoid: geo.districtGeoid || "",
      }
      : null;
  }

  function addPlace() {
    const current = assumptionsRef.current;
    if (!current) return;
    persistAssumptions({
      ...current,
      destinations: [
        ...(current.destinations || []),
        { id: crypto.randomUUID(), name: "", address: "", lat: null, lng: null },
      ],
    });
  }

  function updatePlace(id: string, patch: Partial<Destination>) {
    const current = assumptionsRef.current;
    if (!current || !writableBoard.current) return;
    persistAssumptions({
      ...current,
      destinations: (current.destinations || []).map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  }

  async function locatePlace(place: Destination, board: string) {
    const coords = await locateAddress(place.address, place.name);
    if (writableBoard.current !== board) return;
    if (coords) updatePlace(place.id, coords);
  }

  function removePlace(id: string) {
    const current = assumptionsRef.current;
    if (!current) return;
    persistAssumptions({
      ...current,
      destinations: (current.destinations || []).filter((item) => item.id !== id),
    });
  }

  useEffect(() => {
    const board = writableBoard.current;
    if (!board || loadedBoardId !== boardId) return undefined;
    const pending = destinations.filter(
      (place) => place.address && place.lat == null && !locatingPlaces.current.has(place.id)
    );
    if (!pending.length) return undefined;
    let cancelled = false;
    (async () => {
      for (const place of pending) {
        if (cancelled || writableBoard.current !== board) return;
        locatingPlaces.current.add(place.id);
        try {
          await locatePlace(place, board);
        } finally {
          locatingPlaces.current.delete(place.id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    destinations.map((place) => `${place.id}:${place.address}:${place.lat}`).join("|"),
    loadedBoardId,
    boardId,
  ]);

  function openHouse(id: string) {
    setHouses((current) => current.filter((item) => !isDraft(item) || item.id === id));
    setActiveId(id);
  }

  function addHouse() {
    const draft = blankHouse();
    setHouses((current) => [...current.filter((item) => !isDraft(item)), draft]);
    setActiveId(draft.id);
    setStatus("");
    setStatusAlert(false);
  }

  async function removeHouse(target?: House | null) {
    if (!target?.id) return;
    if (!isDraft(target)) await fetch(`/api/houses/${target.id}`, { method: "DELETE" });
    setHouses((current) => current.filter((item) => item.id !== target.id));
    if (activeId === target.id) setActiveId(OVERVIEW);
  }

  async function toggleHeart(target?: House | null, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!target?.id) return;
    const hearted = !target.hearted;
    setHouses((current) =>
      current.map((item) => (item.id === target.id ? { ...item, hearted } : item))
    );
    if (isDraft(target)) return;
    const saved = await fetch(`/api/houses/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearted }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!saved) {
      setHouses((current) =>
        current.map((item) => (item.id === target.id ? { ...item, hearted: !hearted } : item))
      );
    }
  }

  async function listingPatch(
    listing: {
      error?: boolean;
      url?: string;
      name?: string;
      price?: number | null;
      taxMonthly?: number | null;
      hoa?: number | null;
      insuranceMonthly?: number | null;
      photo?: string;
      facts?: Partial<Facts>;
      schools?: Partial<Record<keyof Schools, Partial<School> | null>>;
    },
    target: House,
    url: string,
    options: { keepCsv?: boolean } = {}
  ) {
    const keepCsv = options.keepCsv;
    const patch: Partial<House> = {
      url: listing.url || (keepCsv ? target.url || url : url),
      name: keepCsv ? target.name : preferName(listing.name, target.name),
    };
    if (!keepCsv) patch.price = preferPrice(listing.price, target.price);
    if (listing.taxMonthly != null) patch.taxMonthly = listing.taxMonthly;
    if (listing.hoa != null) patch.hoa = listing.hoa;
    if (listing.insuranceMonthly != null) patch.insuranceMonthly = listing.insuranceMonthly;
    if (listing.photo) patch.photo = listing.photo;
    if (
      listing.facts &&
      (listing.facts.beds ||
        listing.facts.sqft ||
        listing.facts.dom != null ||
        listing.facts.community)
    ) {
      patch.facts = {
        ...target.facts,
        ...listing.facts,
        community: listing.facts.community || target.facts?.community || "",
        district: listing.facts.district || target.facts?.district || "",
        districtGeoid: listing.facts.districtGeoid || target.facts?.districtGeoid || "",
        dom: listing.facts.dom != null ? listing.facts.dom : target.facts?.dom,
      };
    }
    if (listing.schools) {
      patch.schools = (["elementary", "middle", "high"] as const).reduce(
        (schools, key) => {
          const incoming = listing.schools?.[key];
          schools[key] = incoming?.name
            ? { ...EMPTY_SCHOOL, ...incoming }
            : target.schools?.[key] || EMPTY_SCHOOL;
          return schools;
        },
        { ...EMPTY_SCHOOLS }
      );
      schoolLookup.current.delete(target.id);
    }
    if (target.lat == null || !pinLooksLocal(target)) {
      const coords = await locateAddress(listing.name || target.name);
      if (coords) {
        patch.lat = coords.lat;
        patch.lng = coords.lng;
        if (coords.districtGeoid) {
          patch.facts = {
            ...(patch.facts || target.facts),
            district: coords.district,
            districtGeoid: coords.districtGeoid,
          };
        }
      }
    }
    return patch;
  }

  async function pullUrl() {
    if (!house) return;
    const url = String(urlBox.current?.value || house.url || "").trim();
    if (!url) {
      setStatus("Paste a listing URL first.");
      return;
    }
    if (pulling.current) return;
    pulling.current = true;
    setStatus("Reading listing…");
    setStatusAlert(false);
    const listing = await fetch("/api/listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, addressHint: house.name }),
    })
      .then((r) => r.json())
      .catch(() => ({ error: true }));
    pulling.current = false;

    if (listing.error && !listing.name) {
      setStatus("Could not read that listing.");
      setStatusAlert(true);
      return;
    }

    if (listing.unavailable) {
      const name = listingLabel({ name: listing.name || house.name, url });
      setStatus(`${name} is ${unavailableReason(listing.status)}. It was not added.`);
      setStatusAlert(true);
      return;
    }

    const patch = await listingPatch(listing, house, url);

    if (isDraft(house)) {
      const payload = { ...house, ...patch, id: undefined, draft: undefined };
      if (assumptions)
        payload.downDollars = defaultDown(payload.price, assumptions, payload.updateCash);
      const saveDraft = (restore = false) =>
        fetch("/api/houses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(restore ? { ...payload, restore: true } : payload),
        })
          .then((r) => r.json())
          .catch(() => null);
      let created = await saveDraft();
      if (created?.reason === "dismissed") {
        const name = created.name || listingLabel(payload);
        const again = window.confirm(`${name} was already added and then deleted. Add it again?`);
        if (!again) {
          setStatus(`${name} was not added.`);
          setStatusAlert(false);
          return;
        }
        created = await saveDraft(true);
      }
      if (!created?.id) {
        setStatus("Could not save that listing.");
        setStatusAlert(true);
        return;
      }
      setHouses((current) => current.map((item) => (item.id === house.id ? created : item)));
      setActiveId(created.id);
    } else {
      updateHouse(patch);
    }
    setStatus(listing.name || listing.price ? "Listing pulled." : "Could not read that listing.");
    setStatusAlert(false);
  }

  async function importCsv(file?: File | null) {
    if (!file || importing.current) return;
    importing.current = true;
    setImportAlert(false);
    setImportStatus("Reading Redfin file…");
    const csv = await file.text();
    const result = await fetch("/api/houses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    })
      .then((r) => r.json())
      .catch(() => ({ error: "Could not import that file." }));

    if (importBox.current) importBox.current.value = "";

    if (result.error) {
      importing.current = false;
      setImportAlert(true);
      setImportStatus(result.error);
      return;
    }

    let created = result.created || [];
    let updated = result.updated || [];
    let dismissed = result.dismissed || [];
    if (dismissed.length) {
      const names = nameList(dismissed);
      const prompt =
        dismissed.length === 1
          ? `${names} was already added and then deleted. Add it again?`
          : `${dismissed.length} homes were already added and then deleted: ${names}. Add them again?`;
      if (window.confirm(prompt)) {
        const restored = await fetch("/api/houses/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv, restoreDismissed: true }),
        })
          .then((r) => r.json())
          .catch(() => ({ error: "Could not add those listings again." }));
        if (restored.error) {
          importing.current = false;
          setImportAlert(true);
          setImportStatus(restored.error);
          return;
        }
        created = [...created, ...(restored.created || [])];
        updated = [...updated, ...(restored.updated || [])];
        dismissed = [];
        if (restored.removed?.length) {
          const gone = new Set(restored.removed.map((item: { id: string }) => item.id));
          setHouses((current) => current.filter((item) => !gone.has(item.id)));
        }
      }
    }
    const unavailable = [...(result.unavailable || [])];
    if (result.removed?.length) {
      const gone = new Set(result.removed.map((item: { id: string }) => item.id));
      setHouses((current) => current.filter((item) => !gone.has(item.id)));
    }
    setHouses((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of updated) byId.set(item.id, { ...byId.get(item.id), ...item });
      for (const item of created) byId.set(item.id, item);
      return [...byId.values()];
    });

    const finish = (added: number) => {
      importing.current = false;
      const loud =
        dismissed.length > 0 || unavailable.length > 0 || (result.outside || []).length > 0;
      setImportAlert(loud);
      setImportStatus(
        importSummary({
          incoming: result.incoming,
          added,
          updated: updated.length,
          skipped: result.skipped,
          dismissed,
          unavailable,
          outside: result.outside,
        })
      );
    };

    if (!created.length) {
      finish(0);
      return;
    }

    let added = created.length;
    for (let i = 0; i < created.length; i += 1) {
      const item = created[i];
      setImportStatus(`Added ${created.length}. Pulling ${i + 1} of ${created.length}…`);
      if (!item.url) continue;
      const listing = await fetch("/api/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url, addressHint: item.name }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (!listing || (listing.error && !listing.name && !listing.price)) continue;
      if (listing.unavailable) {
        await fetch(`/api/houses/${item.id}?remember=0`, { method: "DELETE" });
        setHouses((current) => current.filter((house) => house.id !== item.id));
        added -= 1;
        unavailable.push({
          name: listingLabel({ name: listing.name || item.name, url: item.url }),
          reason: unavailableReason(listing.status),
          removed: false,
        });
        continue;
      }
      const patch = await listingPatch(listing, item, item.url, { keepCsv: true });
      updateHouse(patch, item);
    }

    finish(added);
  }

  async function authenticate({ mode, password }: { mode: AuthMode; password: string }) {
    if (unlockBusy) return;
    setUnlockBusy(true);
    setUnlockError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, mode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUnlockError(result.error || (mode === "create" ? "Could not create workspace" : "Invalid password"));
        return;
      }
      setUnlocked(true);
      setBoardMeta(result.board || result.boards?.[0] || null);
      setBoardId(result.boardId || result.board?.id || "");
      setActiveId(OVERVIEW);
    } catch {
      setUnlockError(mode === "create" ? "Could not create workspace" : "Could not sign in");
    } finally {
      setUnlockBusy(false);
    }
  }

  async function lockBoard() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => null);
    setUnlocked(false);
    setBoardMeta(null);
    setBoardId("");
    setHouses([]);
    assumptionsRef.current = blankAssumptions();
    setAssumptions(blankAssumptions());
    setLoadedBoardId("");
    setUnlockError("");
  }

  async function renameBoard(name: string) {
    const next = name.trim();
    if (!boardMeta || !next || next === boardMeta.name) {
      setBoardName(boardMeta?.name || "");
      return;
    }
    const result = await fetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (result?.board) {
      setBoardMeta(result.board);
      setBoardName(result.board.name);
    } else setBoardName(boardMeta.name);
  }

  if (!sessionReady || unlocked == null || !assumptions || !sale || (house && !analysis)) {
    return (
      <main className="wrap hero">
        <h1>Loading...</h1>
      </main>
    );
  }

  return (
    <>
      <div className="sticky">
        <div className="wrap sticky-inner">
          <div className="brand">
            <small>{brand.tagline}</small>
            <strong>{brand.productName}</strong>
          </div>
          {unlocked && boardMeta ? (
            <div className="house-switcher">
              <Input
                className="search-tab-name"
                value={boardName}
                aria-label="Board name"
                onFocus={() => {
                  boardNameFocused.current = true;
                }}
                onChange={(event) => setBoardName(event.target.value)}
                onBlur={() => {
                  boardNameFocused.current = false;
                  renameBoard(boardName);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    setBoardName(boardMeta.name);
                    boardNameFocused.current = false;
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          ) : null}
          <div className="house-switcher">
            <Button
              className={`overview-btn${showingOverview ? " active" : ""}`}
              variant={showingOverview ? "secondary" : "outline"}
              type="button"
              onClick={() => openHouse(OVERVIEW)}
            >
              All houses
            </Button>
            <Select
              value={showingOverview ? undefined : activeId}
              onValueChange={(value) => {
                if (value) openHouse(value);
              }}
            >
              <SelectTrigger className="min-w-[220px]" aria-label="Select a house">
                <SelectValue placeholder="Choose a house" />
              </SelectTrigger>
              <SelectContent>
                {houses.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.hearted ? "♥ " : ""}
                    {item.name || "New listing"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" type="button" onClick={addHouse} disabled={!unlocked}>
              + Add
            </Button>
            {unlocked ? (
              <Button variant="outline" type="button" onClick={lockBoard}>
                Sign out
              </Button>
            ) : null}
            {house ? (
              <>
                <IconButton
                  kind="heart"
                  on={house.hearted}
                  label={house.hearted ? `Unheart ${house.name}` : `Heart ${house.name}`}
                  title={house.hearted ? "Hearted" : "Heart this house"}
                  onClick={(event) => toggleHeart(house, event)}
                />
                <Button variant="outline" type="button" onClick={() => removeHouse(house)}>
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {showingOverview ? (
        <section className="wrap">
          {!unlocked ? (
            <AuthPanel
              brandName={brand.productName}
              tagline={brand.tagline}
              busy={unlockBusy}
              error={unlockError}
              onSubmit={authenticate}
            />
          ) : null}
          <div className="section-head">
            <div>
              <h2>All houses · {overviewRows.length}</h2>
              <p>
                {!unlocked
                  ? "The board is open with no workspace loaded. Sign in or create a password-only account to save searches."
                  : "Click a column to sort. Import a Redfin CSV. Already-deleted and off-market listings are called out and not added."}
              </p>
            </div>
            <div className="section-actions">
              {unlocked ? (
                <Button variant="outline" className="import-btn" asChild>
                  <label>
                    Import Redfin CSV
                    <input
                      ref={importBox}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => importCsv(e.target.files?.[0])}
                    />
                  </label>
                </Button>
              ) : (
                <Button variant="outline" className="import-btn" type="button" disabled>
                  Import Redfin CSV
                </Button>
              )}
              {importStatus ? (
                <p
                  className={importAlert ? "import-alert" : "note"}
                  role={importAlert ? "alert" : undefined}
                >
                  {importStatus}
                </p>
              ) : null}
            </div>
          </div>
          <div className="overview-layout">
            <Card className="overview-card">
              {overviewRows.length ? (
                <>
                  <div className="overview-search">
                    <Input
                      type="search"
                      value={streetQuery}
                      onChange={(e) => setStreetQuery(e.target.value)}
                      placeholder="Search street or community"
                      aria-label="Search by street or community"
                    />
                    {streetQuery.trim() ? (
                      <p className="note">
                        {visibleRows.length} of {overviewRows.length}
                      </p>
                    ) : null}
                  </div>
                  <div className="overview-scroll">
                    {visibleRows.length ? (
                      <Table className="overview">
                        <TableHeader>
                          <TableRow>
                            <TableHead>House</TableHead>
                            <SortTh label="Price" sortKey="price" sort={sort} onSort={toggleSort} />
                            <TableHead>Rooms</TableHead>
                            <SortTh label="Sqft" sortKey="sqft" sort={sort} onSort={toggleSort} />
                            <SortTh label="Lot" sortKey="lot" sort={sort} onSort={toggleSort} />
                            <SortTh label="Mo" sortKey="housing" sort={sort} onSort={toggleSort} />
                            <SortTh
                              label="Subdivision"
                              sortKey="community"
                              sort={sort}
                              onSort={toggleSort}
                            />
                            <SortTh label="Difference" sortKey="gap" sort={sort} onSort={toggleSort} />
                            <TableHead>Sch</TableHead>
                            <SortTh
                              label={commute?.name || "Drive"}
                              sortKey="drive"
                              sort={sort}
                              onSort={toggleSort}
                            />
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRows.map(({ house: item, analysis: row }) => (
                            <TableRow
                              key={item.id}
                              className={`${hoverId === item.id ? "is-hover" : ""}${item.hearted ? " is-hearted" : ""}${item.notes?.trim() ? " has-note" : ""}`}
                              onClick={() => openHouse(item.id)}
                              onMouseEnter={() => setHoverId(item.id)}
                              onMouseLeave={() =>
                                setHoverId((current) => (current === item.id ? "" : current))
                              }
                            >
                              <TableCell>
                                <div className="overview-house">
                                  {item.photo ? <img src={item.photo} alt="" /> : null}
                                  <span className="overview-link" title={item.name}>
                                    {shortName(item.name)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{item.price ? money(item.price) : "—"}</TableCell>
                              <TableCell>
                                {item.facts?.beds || "—"} / {item.facts?.baths || "—"}
                              </TableCell>
                              <TableCell>
                                {item.facts?.sqft ? Number(item.facts.sqft).toLocaleString() : "—"}
                              </TableCell>
                              <TableCell>{lotLabel(item.facts)}</TableCell>
                              <TableCell>{money(row.housing)}</TableCell>
                              <TableCell
                                className="community-cell"
                                title={item.facts?.community || ""}
                              >
                                {item.facts?.community || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={row.gap < 0 ? "destructive" : "secondary"}>
                                  {money(row.gap)}
                                </Badge>
                              </TableCell>
                              <TableCell
                                title={["elementary", "middle", "high"]
                                  .map((key) => item.schools?.[key]?.name || "—")
                                  .join(" / ")}
                              >
                                {schoolMarks(item.schools)}
                              </TableCell>
                              <TableCell>
                                {driveTimes[item.id]?.minutes != null
                                  ? `${driveTimes[item.id].minutes}m`
                                  : driveTimes[item.id]?.miles != null
                                    ? `${driveTimes[item.id].miles}mi`
                                    : "—"}
                              </TableCell>
                              <TableCell>
                                <div
                                  className="overview-actions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <IconButton
                                    kind="heart"
                                    on={item.hearted}
                                    label={
                                      item.hearted ? `Unheart ${item.name}` : `Heart ${item.name}`
                                    }
                                    title={item.hearted ? "Hearted" : "Heart this house"}
                                    onClick={(event) => toggleHeart(item, event)}
                                  />
                                  <ListingIcon href={item.url} />
                                  <IconButton
                                    kind="close"
                                    label={`Delete ${item.name}`}
                                    title="Delete"
                                    onClick={() => removeHouse(item)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="note">No streets match.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="note">Add a house to start comparing.</p>
              )}
            </Card>
            <div className="overview-map-row">
              <Card className="map-card overview-map-card">
                <CardHeader>
                  <CardTitle>Map</CardTitle>
                </CardHeader>
                <CardContent className="map-stage">
                  {unlocked && mapViews[boardId] ? (
                    <div className="overview-map-slot is-active">
                      <OverviewMap
                        active
                        pins={mapViews[boardId].pins}
                        districts={mapViews[boardId].districts}
                        area={mapViews[boardId].area}
                        places={mapViews[boardId].places}
                        hoverId={hoverId}
                        onSelect={openHouse}
                        onHover={(id) => setHoverId(id || "")}
                      />
                    </div>
                  ) : null}
                  {!unlocked ? (
                    <div className="map-empty">Sign in to load map pins for a search.</div>
                  ) : !mapViews[boardId] ? (
                    <div className="map-empty">Loading this search…</div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      ) : house && analysis ? (
        <>
          <header className="wrap hero">
            <div className="compare">
              <Card className="hero-card a">
                <h2>New monthly housing</h2>
                <div className="big-row">
                  <div className="big">{money(analysis.housing)}</div>
                  {analysis.vsCurrent != null && Math.abs(analysis.vsCurrent) >= 0.5 ? (
                    <span className={`housing-delta${analysis.vsCurrent < 0 ? " gain" : " loss"}`}>
                      {analysis.vsCurrent < 0 ? "↓" : "↑"} {money(Math.abs(analysis.vsCurrent))}
                    </span>
                  ) : null}
                </div>
              </Card>

              <Card className="hero-card b">
                <h2>Difference</h2>
                <div className="big">{money(analysis.gap)}</div>
              </Card>
            </div>
          </header>

          <section className="wrap">
            <div className="section-head">
              <h2>This listing</h2>
              <p>
                Paste a listing URL. Address, price, tax, insurance, HOA, and assigned schools fill
                in when we can read them.
              </p>
            </div>
            <div className="grid-2">
              <Card>
                <CardHeader>
                  <CardTitle>House details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="field">
                    <Label>Listing URL</Label>
                  </div>
                  <div className="wide" style={{ marginBottom: 12 }}>
                    <Input
                      ref={urlBox}
                      value={house.url}
                      placeholder="https://www.zillow.com/homedetails/..."
                      onChange={(e) => updateHouse({ url: e.target.value })}
                    />
                    <Button variant="outline" type="button" onClick={pullUrl}>
                      Pull listing
                    </Button>
                    <ListingIcon href={house.url} />
                  </div>
                  {status ? (
                    <p
                      className={statusAlert ? "import-alert" : "note"}
                      role={statusAlert ? "alert" : undefined}
                    >
                      {status}
                    </p>
                  ) : null}
                  <Field
                    label="Tab name"
                    text
                    value={house.name}
                    onChange={(v) => updateHouse({ name: v })}
                  />
                  <Field
                    label="Purchase price"
                    prefix="$"
                    value={house.price}
                    onChange={(v) => updateHouse({ price: Number(v) || 0 })}
                  />
                  <Field
                    label="Money down (includes closing)"
                    prefix="$"
                    value={Math.round(analysis.down + analysis.closing)}
                    onChange={(v) =>
                      updateHouse({
                        downDollars: Math.max(0, Math.round((Number(v) || 0) - analysis.closing)),
                      })
                    }
                  />
                  <p className="note">
                    This is cash to close: loan down plus purchase closing. The leftover cash target
                    in Shared numbers sets this for every house.
                  </p>
                  <Field label="Toward the loan" computed value={money(analysis.down)} />
                  <Field label="Purchase closing (3.5%)" computed value={money(analysis.closing)} />
                  <Field label="Loan down" computed value={`${analysis.downPct.toFixed(1)}%`} />
                  <Field
                    label="Property tax / mo"
                    prefix="$"
                    value={house.taxMonthly ?? ""}
                    onChange={(v) => updateHouse({ taxMonthly: v === "" ? null : Number(v) || 0 })}
                  />
                  <Field
                    label="Homeowner insurance"
                    prefix="$"
                    value={house.insuranceMonthly}
                    onChange={(v) => updateHouse({ insuranceMonthly: Number(v) || 0 })}
                  />
                  <Field
                    label="HOA / mo"
                    prefix="$"
                    value={house.hoa}
                    onChange={(v) => updateHouse({ hoa: Number(v) || 0 })}
                  />
                  <Field
                    label="Immediate updates / repairs"
                    prefix="$"
                    value={house.updateCash}
                    onChange={(v) => updateHouse({ updateCash: Number(v) || 0 })}
                  />
                  <Field label="Your available cash" computed value={money(sale.cashAfterTax)} />
                  <p className="note">
                    {money(sale.cashAvailable)} available for the down payment, plus{" "}
                    {money(assumptions.keepCash)} leftover you chose to keep.
                  </p>
                </CardContent>
              </Card>

              <Card className="schools-card">
                <CardHeader>
                  <CardTitle>House metrics</CardTitle>
                </CardHeader>
                <CardContent className="schools-body">
                  {house.photo ? (
                    <div className="house-photo">
                      <img src={house.photo} alt={house.name} />
                    </div>
                  ) : null}
                  <div className="house-facts">
                    <div className="house-facts-grid">
                      <Field
                        compact
                        label="Beds"
                        value={house.facts?.beds ?? ""}
                        onChange={(v) => updateFacts({ beds: parseFactNumber(v) })}
                      />
                      <Field
                        compact
                        label="Baths"
                        value={house.facts?.baths ?? ""}
                        onChange={(v) => updateFacts({ baths: parseFactNumber(v) })}
                      />
                      <Field
                        compact
                        label="Sq ft"
                        value={house.facts?.sqft ?? ""}
                        onChange={(v) => updateFacts({ sqft: parseFactNumber(v) })}
                      />
                      <Field
                        compact
                        label="Lot"
                        suffix="ac"
                        value={lotAcresInput(house.facts)}
                        onChange={(v) => {
                          const acres = parseFactNumber(v);
                          updateFacts({
                            lotAcres: acres,
                            lotSqft: acres == null ? null : Math.round(acres * 43560),
                          });
                        }}
                      />
                      <Field
                        compact
                        label="Community"
                        text
                        value={house.facts?.community || ""}
                        onChange={(v) => updateFacts({ community: v })}
                      />
                      <Field
                        compact
                        label="On market"
                        suffix="days"
                        value={house.facts?.dom ?? ""}
                        onChange={(v) => updateFacts({ dom: parseFactNumber(v) })}
                      />
                    </div>
                    <p className="note">
                      Pull listing fills these when it can. Edit anything it misses.
                    </p>
                  </div>
                  <h3>Assigned schools</h3>
                  <div className="school-list">
                    {(
                      [
                        ["elementary", "Elementary"],
                        ["middle", "Middle"],
                        ["high", "High"],
                      ] as const
                    ).map(([key, label]) => {
                      const school = house.schools?.[key] || EMPTY_SCHOOL;
                      const rating = school.rating;
                      return (
                        <div className="school-row" key={key}>
                          <span className="school-level">{label}</span>
                          <div className="school-main">
                            {school.url ? (
                              <a href={school.url} target="_blank" rel="noreferrer">
                                {school.name || "—"}
                              </a>
                            ) : (
                              <strong>{school.name || "—"}</strong>
                            )}
                            <small>
                              {school.source ? `${school.source} rating` : "Rating pending"}
                            </small>
                          </div>
                          <Badge
                            variant={
                              rating != null && rating >= 8
                                ? "secondary"
                                : rating != null && rating < 5
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {rating != null ? `${rating}/10` : "—"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <p className="note">
                    Assigned schools come from the listing. The high school zone is from local
                    attendance maps. Ratings are GreatSchools when we can find the profile.
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="notes-card">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="notes-input"
                  value={house.notes || ""}
                  placeholder="What stood out, what to check, or why this one is still in the mix."
                  rows={5}
                  onChange={(e) => updateHouse({ notes: e.target.value })}
                />
              </CardContent>
            </Card>
            <Card className="map-card">
              <CardHeader>
                <CardTitle>Map & drive times</CardTitle>
              </CardHeader>
              <CardContent>
                <ListingMap house={house} destinations={destinations} trips={trips} />
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      <section className="wrap">
        <div className="section-head">
          <h2>Shared numbers</h2>
          <p>These stay the same across every house tab.</p>
        </div>
        <div className="shared-numbers">
          <div className="grid-2">
            <Card>
              <CardHeader>
                <CardTitle>Cash for Purchase</CardTitle>
              </CardHeader>
              <CardContent>
                <Field
                  label="Estimated sale price"
                  prefix="$"
                  value={assumptions.salePrice}
                  onChange={(v) => updateAssumption("salePrice", v)}
                />
                <Field
                  label="Mortgage payoff"
                  prefix="$"
                  value={assumptions.payoff}
                  onChange={(v) => updateAssumption("payoff", v)}
                />
                <Field
                  label="Listing agent"
                  suffix="%"
                  value={assumptions.listingAgentPct ?? ""}
                  result={moneyFine(sale.listingCommission)}
                  onChange={(v) => updateAssumption("listingAgentPct", v)}
                />
                <Field
                  label="Buyer's agent"
                  suffix="%"
                  value={assumptions.buyerAgentPct ?? ""}
                  result={moneyFine(sale.buyerCommission)}
                  onChange={(v) => updateAssumption("buyerAgentPct", v)}
                />
                <Field
                  label="Other selling fees"
                  prefix="$"
                  value={assumptions.otherSellingFees}
                  onChange={(v) => updateAssumption("otherSellingFees", v)}
                />
                <Field label="Total selling fees" computed value={moneyFine(sale.sellingCosts)} />
                <Field label="Net to sellers" computed value={moneyFine(sale.netProceeds)} />
                <Field
                  label="My other cash"
                  prefix="$"
                  value={assumptions.extraCash}
                  onChange={(v) => updateAssumption("extraCash", v)}
                />
                <Field
                  label="Cash I want left over"
                  prefix="$"
                  value={assumptions.keepCash}
                  onChange={(v) => updateAssumption("keepCash", v)}
                />
                <Field
                  label="Cash available for home purchase"
                  computed
                  total
                  value={money(sale.cashAvailable)}
                />
                <p className="note">
                  Changing leftover cash or agent percents updates money down on every house so
                  leftover cash stays after closing and updates.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expected Income/Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                {(assumptions.extraItems || []).map((item) => (
                  <div
                    className={`field extra-row${item.enabled === false ? " is-off" : ""}`}
                    key={item.id}
                  >
                    <Checkbox
                      checked={item.enabled !== false}
                      onCheckedChange={(checked) =>
                        updateExtra(item.id, { enabled: checked === true })
                      }
                      aria-label={`Include ${item.label || "this line"} in the difference`}
                    />
                    <Input
                      className="name-input"
                      value={item.label}
                      placeholder="Label"
                      aria-label="Income or expense label"
                      onChange={(e) => updateExtra(item.id, { label: e.target.value })}
                    />
                    <div className="control">
                      <span className="suffix">$</span>
                      <SignedAmount
                        value={item.amount}
                        onChange={(amount) => updateExtra(item.id, { amount })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      onClick={() => removeExtra(item.id)}
                      aria-label="Remove line"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="field">
                  <Button variant="outline" type="button" onClick={addExtra}>
                    + Add line
                  </Button>
                </div>
                <Field
                  label="Expected income/expenses total"
                  computed
                  total
                  value={money(expenseTotal(assumptions.extraItems))}
                />
                <Field
                  label="Today's monthly housing"
                  prefix="$"
                  value={assumptions.currentHousing}
                  onChange={(v) => updateAssumption("currentHousing", v)}
                />
                <p className="note">
                  Checked amounts are shared by every house. A positive amount is money coming in.
                  A negative amount is money going out. Today&apos;s monthly housing is separate from
                  that total. Each house difference adds these lines and today&apos;s housing, then
                  subtracts the monthly payment on that home.
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid-2">
            <Card>
              <CardHeader>
                <CardTitle>New Mortgage</CardTitle>
              </CardHeader>
              <CardContent>
                <Field
                  label="Interest rate"
                  suffix="%"
                  value={assumptions.rate}
                  onChange={(v) => updateAssumption("rate", v)}
                />
                <Field
                  label="Purchase closing costs"
                  suffix="%"
                  value={assumptions.closingPct}
                  onChange={(v) => updateAssumption("closingPct", v)}
                />
                <Field
                  label="Loan term"
                  suffix="yr"
                  value={assumptions.termYears}
                  onChange={(v) => updateAssumption("termYears", v)}
                />
              </CardContent>
            </Card>
            <Card className="places-card">
              <CardHeader>
                <CardTitle>Places to measure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="note" style={{ marginTop: 0, marginBottom: 8 }}>
                  Add work, family, or school. Each house tab shows drive time from that listing.
                </p>
                {destinations.map((place) => (
                  <div className="field place-row" key={place.id}>
                    <Input
                      className="name-input"
                      value={place.name}
                      placeholder="Work"
                      onChange={(e) => updatePlace(place.id, { name: e.target.value })}
                    />
                    <Input
                      className="addr-input"
                      value={place.address}
                      placeholder="123 Main St, Charlotte, NC"
                      onChange={(e) =>
                        updatePlace(place.id, { address: e.target.value, lat: null, lng: null })
                      }
                      onBlur={(e) => {
                        const board = writableBoard.current;
                        if (!board) return;
                        locatePlace({ ...place, address: e.target.value }, board);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      onClick={() => removePlace(place.id)}
                      aria-label="Remove place"
                    >
                      ×
                    </Button>
                    {place.address && place.lat == null ? (
                      <small className="note">Not on the map yet</small>
                    ) : null}
                  </div>
                ))}
                <div className="field">
                  <Button variant="outline" type="button" onClick={addPlace}>
                    + Add place
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>


    </>
  );
}
