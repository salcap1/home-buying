"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as LeafletMap, Marker } from "leaflet";
import { MapPin } from "lucide-react";
import { addQuietTiles } from "../lib/layers/basemap";
import { circleEnvelope } from "../lib/search-area";
import type { Destination, MapPin as ListingPin, SchoolDistrict } from "../lib/types";

const DISTRICT_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#db2777"];

type MapArea = {
  lat: number;
  lng: number;
  radiusMiles: number;
};

type MapCounty = {
  geoid: string;
  name: string;
  selected: boolean;
  geometry?: { type: string; coordinates?: unknown } | null;
};

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function applyHover(markers: Map<string, Marker>, hoverId?: string) {
  markers.forEach((marker, id) => {
    const active = id === hoverId;
    marker.getElement()?.classList.toggle("is-hover", active);
    marker.setZIndexOffset(active ? 1000 : 0);
  });
}

export default function OverviewMap({
  pins,
  places = [],
  districts = [],
  counties = [],
  area = null,
  active = true,
  onToggleCounty,
  hoverId,
  onSelect,
  onHover,
}: {
  pins: ListingPin[];
  places?: Destination[];
  districts?: SchoolDistrict[];
  counties?: MapCounty[];
  area?: MapArea | null;
  active?: boolean;
  onToggleCounty?: (county: MapCounty) => void;
  hoverId?: string;
  onSelect?: (id: string) => void;
  onHover?: (id: string) => void;
}) {
  const shaded = useMemo(
    () =>
      [...districts]
        .filter((district) => district.geometry)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((district, index) => ({ ...district, color: DISTRICT_COLORS[index % DISTRICT_COLORS.length] })),
    [districts]
  );
  const [showPlaces, setShowPlaces] = useState(true);
  const [showDistricts, setShowDistricts] = useState(true);
  const showDistrictsRef = useRef(showDistricts);
  showDistrictsRef.current = showDistricts;
  const districtLayerRef = useRef<{ addTo: (map: LeafletMap) => void; remove: () => void } | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const applyViewRef = useRef<(() => void) | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const placesRef = useRef<Marker[]>([]);
  const pinsRef = useRef(pins);
  const selectRef = useRef(onSelect);
  const hoverRef = useRef(onHover);
  const hoverIdRef = useRef(hoverId);
  const [cardId, setCardId] = useState("");
  const cardIdRef = useRef(cardId);
  const toggleRef = useRef(onToggleCounty);
  const viewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const frameKeyRef = useRef("");
  toggleRef.current = onToggleCounty;
  const showPlacesRef = useRef(showPlaces);
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const placeHoverCardRef = useRef<() => void>(() => {});
  selectRef.current = onSelect;
  hoverRef.current = onHover;
  hoverIdRef.current = hoverId;
  cardIdRef.current = cardId;
  showPlacesRef.current = showPlaces;
  pinsRef.current = pins;
  const cardPin = pins.find((pin) => pin.id === cardId && pin.lat != null && pin.lng != null);

  placeHoverCardRef.current = () => {
    const card = hoverCardRef.current;
    const map = mapRef.current;
    const frame = frameRef.current;
    const pin = pinsRef.current.find((item) => item.id === cardIdRef.current);
    if (!card || !map?.getPane("mapPane") || !frame || !pin || pin.lat == null || pin.lng == null) return;
    let point;
    try {
      point = map.latLngToContainerPoint([pin.lat, pin.lng]);
    } catch {
      return;
    }
    const origin = frame.getBoundingClientRect();
    const anchorX = origin.left + point.x;
    const anchorY = origin.top + point.y;
    const margin = 8;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    card.style.width = "";
    card.style.maxHeight = "";
    const photo = card.querySelector("img");
    if (photo) photo.style.height = "";
    let cardW = card.offsetWidth;
    let cardH = card.offsetHeight;
    const roomH = vh - margin * 2;
    if (cardW > vw - margin * 2) {
      card.style.width = `${vw - margin * 2}px`;
      cardW = card.offsetWidth;
      cardH = card.offsetHeight;
    }
    if (photo && cardH > roomH) {
      photo.style.height = `${Math.max(72, photo.offsetHeight - (cardH - roomH))}px`;
      cardH = card.offsetHeight;
    }
    let left = anchorX - cardW / 2;
    let top = anchorY - cardH - gap;
    const belowTop = anchorY + gap;
    if (top < margin && belowTop + cardH <= vh - margin) top = belowTop;
    left = Math.min(Math.max(left, margin), Math.max(margin, vw - cardW - margin));
    top = Math.min(Math.max(top, margin), Math.max(margin, vh - cardH - margin));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.add("is-placed");
    card.querySelectorAll("img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", () => placeHoverCardRef.current(), { once: true });
    });
  };

  const key = [
    pins.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}:${pin.label}:${pin.photo || ""}:${pin.schools || ""}:${pin.html}`).join("|"),
    places.map((place) => `${place.id}:${place.lat}:${place.lng}:${place.name}`).join("|"),
    shaded.map((district) => `${district.geoid}:${district.color}`).join("|"),
    counties.map((county) => `${county.geoid}:${county.selected ? 1 : 0}`).join("|"),
    area ? `${area.lat}:${area.lng}:${area.radiusMiles}` : "",
  ].join("||");

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    let onResize: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    let viewFrame = 0;

    async function draw() {
      if (!holder.current || (!pins.length && !places.length && !counties.length && !area)) return;
      const leaflet = await import("leaflet");
      const L = leaflet.default || leaflet;
      if (cancelled || !holder.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = new Map();

      const start = area
        ? { center: [area.lat, area.lng] as [number, number], zoom: 10 }
        : pins.length
          ? { center: [pins[0].lat, pins[0].lng] as [number, number], zoom: 12 }
          : { center: [39.5, -98.35] as [number, number], zoom: 4 };
      map = L.map(holder.current, {
        scrollWheelZoom: true,
        zoomControl: false,
        attributionControl: false,
        ...(start || {}),
      });
      mapRef.current = map;
      addQuietTiles(L, map);
      const countyKey = counties.map((county) => county.geoid).join("|");
      const areaKey = area ? `${area.lat}:${area.lng}:${area.radiusMiles}` : "";
      const frameKey = `${areaKey}|${countyKey}`;
      const restoreView = frameKeyRef.current === frameKey ? viewRef.current : null;
      frameKeyRef.current = frameKey;
      if (!map.getPane("counties")) {
        map.createPane("counties");
        const pane = map.getPane("counties");
        if (pane) pane.style.zIndex = "320";
      }
      const countyLayer = L.geoJSON(
        {
          type: "FeatureCollection",
          features: counties
            .filter((county) => county.selected && county.geometry)
            .map((county) => ({
              type: "Feature",
              properties: { geoid: county.geoid, name: county.name, selected: county.selected },
              geometry: county.geometry as GeoJSON.Geometry,
            })),
        } as GeoJSON.FeatureCollection,
        {
          pane: "counties",
          style: (feature) =>
            feature?.properties?.selected
              ? { color: "#1d4ed8", fillColor: "#2563eb", weight: 2, fillOpacity: 0.16 }
              : { color: "#64748b", fillColor: "#94a3b8", weight: 1.5, fillOpacity: 0.04 },
          onEachFeature: (feature, layer) => {
            const name = String(feature.properties?.name || "County");
            layer.bindTooltip(name, { sticky: true, className: "overview-tip" });
            layer.on("click", () => {
              const geoid = String(feature.properties?.geoid || "");
              const county = counties.find((item) => item.geoid === geoid);
              if (county) toggleRef.current?.(county);
            });
          },
        }
      ).addTo(map);
      if (!map.getPane("districts")) {
        map.createPane("districts");
        const pane = map.getPane("districts");
        if (pane) pane.style.zIndex = "350";
      }
      const districtLayer = L.layerGroup();
      for (const district of shaded) {
        L.geoJSON(
          {
            type: "Feature",
            properties: { name: district.name },
            geometry: district.geometry,
          } as GeoJSON.Feature,
          {
            pane: "districts",
            interactive: false,
            style: {
              color: district.color,
              fillColor: district.color,
              weight: 2.5,
              fillOpacity: 0.06,
              opacity: 0.9,
            },
          }
        ).addTo(districtLayer);
      }
      if (showDistrictsRef.current) districtLayer.addTo(map);
      districtLayerRef.current = districtLayer;

      const markers = new Map<string, Marker>();
      for (const pin of pins) {
        const marker = L.marker([pin.lat, pin.lng], {
          icon: L.divIcon({
            className: "overview-pin",
            html: `<span>${pin.label}</span>`,
            iconSize: [68, 28],
            iconAnchor: [34, 28],
          }),
        }).addTo(map);
        marker.on("click", () => {
          const coarse =
            typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
          if (coarse) {
            if (cardIdRef.current === pin.id) {
              selectRef.current?.(pin.id);
              return;
            }
            setCardId(pin.id);
            hoverRef.current?.(pin.id);
            return;
          }
          selectRef.current?.(pin.id);
        });
        marker.on("mouseover", () => {
          if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
            return;
          }
          setCardId(pin.id);
          hoverRef.current?.(pin.id);
        });
        marker.on("mouseout", () => {
          if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
            return;
          }
          setCardId("");
          hoverRef.current?.("");
        });
        markers.set(pin.id, marker);
      }
      const placeMarkers: Marker[] = [];
      for (const place of places) {
        if (place.lat == null || place.lng == null) continue;
        const marker = L.marker([place.lat, place.lng], {
          icon: L.divIcon({
            className: "overview-pin overview-place",
            html: `<span>${escapeHtml(place.name)}</span>`,
            iconSize: [88, 28],
            iconAnchor: [44, 28],
          }),
          zIndexOffset: 400,
          interactive: false,
        });
        if (showPlacesRef.current) marker.addTo(map);
        placeMarkers.push(marker);
      }
      placesRef.current = placeMarkers;
      markersRef.current = markers;
      applyHover(markers, hoverIdRef.current);

      const bounds = pins.map((pin) => [pin.lat, pin.lng] as [number, number]);
      let fitted = false;
      const mapIsLive = () =>
        !cancelled && map != null && mapRef.current === map && Boolean(map.getPane("mapPane"));
      const applyView = () => {
        if (!mapIsLive() || !map) return;
        const container = map.getContainer();
        if (!container?.isConnected || !container.offsetWidth || !container.offsetHeight) return;
        try {
          map.invalidateSize({ animate: false, pan: false });
          const still = { animate: false as const };
          if (restoreView) {
            map.setView(restoreView.center, restoreView.zoom, still);
          } else if (area) {
            const box = circleEnvelope(area);
            if (![box.xmin, box.ymin, box.xmax, box.ymax].every(Number.isFinite)) return;
            map.fitBounds(
              [
                [box.ymin, box.xmin],
                [box.ymax, box.xmax],
              ],
              { padding: [28, 28], ...still }
            );
          } else if (countyLayer.getLayers().length) {
            const countyBounds = countyLayer.getBounds();
            if (!countyBounds.isValid()) return;
            map.fitBounds(countyBounds, { padding: [28, 28], ...still });
          } else if (!bounds.length) {
            return;
          } else if (bounds.length === 1) {
            map.setView(bounds[0], 13, still);
          } else {
            map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13, ...still });
          }
          fitted = true;
        } catch {
          // fitBounds reads the map pane. A newer search can remove the map before this frame runs.
        }
      };
      applyViewRef.current = applyView;
      applyView();
      onResize = () => {
        applyView();
        if (mapIsLive()) placeHoverCardRef.current();
      };
      map.on("move zoom", () => {
        if (mapIsLive()) placeHoverCardRef.current();
      });
      viewFrame = requestAnimationFrame(() => {
        applyView();
        if (mapIsLive()) placeHoverCardRef.current();
      });
      window.addEventListener("resize", onResize);
      observer = new ResizeObserver(() => {
        if (!mapIsLive() || !map) return;
        const container = map.getContainer();
        if (!container?.offsetWidth || !container.offsetHeight) return;
        if (!fitted) {
          applyView();
          return;
        }
        try {
          map.invalidateSize({ animate: false, pan: false });
        } catch {
          // The container can report a size while Leaflet is tearing the map down.
        }
      });
      if (cancelled) {
        cancelAnimationFrame(viewFrame);
        applyViewRef.current = null;
        observer.disconnect();
        return;
      }
      if (holder.current) observer.observe(holder.current);
    }

    draw();
    return () => {
      cancelled = true;
      cancelAnimationFrame(viewFrame);
      applyViewRef.current = null;
      observer?.disconnect();
      if (mapRef.current) {
        try {
          const center = mapRef.current.getCenter();
          viewRef.current = { center: [center.lat, center.lng], zoom: mapRef.current.getZoom() };
        } catch {
          viewRef.current = null;
        }
      }
      if (onResize) window.removeEventListener("resize", onResize);
      markersRef.current = new Map();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [key]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => applyViewRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useLayoutEffect(() => {
    applyHover(markersRef.current, hoverId);
  }, [hoverId]);

  useLayoutEffect(() => {
    hoverCardRef.current?.classList.remove("is-placed");
    placeHoverCardRef.current();
    if (!cardId) return;
    const follow = () => placeHoverCardRef.current();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [cardId, cardPin?.html]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = districtLayerRef.current;
    if (!layer) return;
    if (showDistricts) layer.addTo(map);
    else layer.remove();
  }, [showDistricts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of placesRef.current) {
      if (showPlaces) marker.addTo(map);
      else map.removeLayer(marker);
    }
  }, [showPlaces]);

  if (!pins.length && !places.length && !counties.length && !area) {
    return (
      <div className="map-empty">
        Add a house to see it on the map.
      </div>
    );
  }

  return (
    <div className="overview-map-stack">
      <div ref={frameRef} className="overview-map-frame">
        <div ref={holder} className="map-canvas overview-map" />
        {cardPin && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={hoverCardRef}
                role="button"
                tabIndex={0}
                className="overview-hover overview-hover-button"
                aria-label={`Open listing`}
                onClick={() => selectRef.current?.(cardPin.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRef.current?.(cardPin.id);
                  }
                }}
                dangerouslySetInnerHTML={{ __html: cardPin.html }}
              />,
              document.body
            )
          : null}
      </div>
      {shaded.length || places.length ? (
        <aside className="district-legend" aria-label="Map layers">
          {places.length ? (
            <label className="legend-toggle">
              <input
                type="checkbox"
                checked={showPlaces}
                onChange={(event) => setShowPlaces(event.target.checked)}
              />
              <MapPin size={12} strokeWidth={2} className="legend-icon legend-place" aria-hidden />
              <span>Places</span>
            </label>
          ) : null}
          {shaded.length ? (
            <section className="map-district-group">
              <label className="legend-toggle">
                <input
                  type="checkbox"
                  checked={showDistricts}
                  onChange={(event) => setShowDistricts(event.target.checked)}
                />
                <span>School districts</span>
              </label>
              <ul>
                {shaded.map((district) => (
                  <li key={district.geoid}>
                    <i style={{ borderColor: district.color }} />
                    <span className="map-district-name">{district.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
