"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { House, MapPin } from "lucide-react";
import { addQuietTiles } from "../lib/layers/basemap";
import { HOUSE_ICON, PLACE_ICON, SCHOOL_ICON } from "../lib/map-icons";
import { assignedSchoolPins } from "../lib/school-pins";
import type { Destination, DriveTime, House as Listing } from "../lib/types";

type Trip = DriveTime & { id: string };

type MapPoint = {
  id: string;
  kind: "house" | "place";
  name: string;
  detail: string;
  lat: number | null;
  lng: number | null;
};

function tripLabel(trip?: DriveTime | null) {
  if (!trip || trip.miles == null) return "Travel time pending";
  if (trip.minutes != null) return `${trip.miles} mi · ${trip.minutes} min drive`;
  return `${trip.miles} mi${trip.mode === "straight" ? " straight-line" : ""}`;
}

export default function ListingMap({
  house,
  destinations,
  trips,
}: {
  house: Listing | null;
  destinations: Destination[];
  trips: Trip[];
}) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const schools = assignedSchoolPins(house);
  const points: MapPoint[] = [];
  if (house?.lat != null && house?.lng != null) {
    points.push({
      id: "listing",
      kind: "house",
      name: house.name || "This listing",
      detail: "Listing",
      lat: house.lat,
      lng: house.lng,
    });
  }
  for (const place of destinations || []) {
    const trip = (trips || []).find((item) => item.id === place.id);
    const pinned = place.lat != null && place.lng != null;
    points.push({
      id: place.id,
      kind: "place",
      name: place.name || place.address || "Place",
      detail: pinned ? tripLabel(trip) : "Not on the map yet",
      lat: pinned ? place.lat : null,
      lng: pinned ? place.lng : null,
    });
  }

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;

    async function draw() {
      if (!holder.current || !points.length) return;
      const leaflet = await import("leaflet");
      const L = leaflet.default || leaflet;
      if (cancelled || !holder.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      map = L.map(holder.current, {
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;
      addQuietTiles(L, map);

      points
        .filter((point) => point.lat != null && point.lng != null)
        .forEach((point) => {
          const marker = L.marker([point.lat as number, point.lng as number], {
            icon: L.divIcon({
              className: `map-pin map-pin-${point.kind}`,
              html: `<span>${point.kind === "house" ? HOUSE_ICON : PLACE_ICON}</span>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            }),
          }).addTo(map!);
          marker.bindPopup(`<strong>${point.name}</strong><br>${point.detail}`);
        });
      for (const school of schools) {
        if (school.lat == null || school.lng == null) continue;
        L.marker([school.lat, school.lng], {
          icon: L.divIcon({
            className: `school-pin school-pin-${school.level}`,
            html: SCHOOL_ICON,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          zIndexOffset: -200,
          keyboard: false,
        })
          .addTo(map)
          .bindTooltip(school.name, {
            className: "school-tip",
            direction: "top",
            offset: [0, -10],
            opacity: 1,
            sticky: false,
          });
      }

      const homes = points.filter((point) => point.kind === "house" && point.lat != null && point.lng != null);
      const frame = () => {
        map?.invalidateSize();
        if (!map || !homes.length) return;
        if (homes.length === 1) {
          map.setView([homes[0].lat as number, homes[0].lng as number], 13);
        } else {
          map.fitBounds(L.latLngBounds(homes.map((point) => [point.lat as number, point.lng as number])), {
            padding: [36, 36],
            maxZoom: 13,
          });
        }
      };
      frame();
      requestAnimationFrame(frame);
    }

    draw();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [JSON.stringify(points), JSON.stringify(schools)]);

  if (!points.length) {
    return (
      <div className="map-empty">
        Add a listing address and at least one place below to pin them here.
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div ref={holder} className="map-canvas" />
      <ul className="map-legend">
        {points.map((point) => (
          <li key={point.id}>
            <span className={`map-dot map-pin-${point.kind}`}>
              {point.kind === "house" ? <House size={14} strokeWidth={2} /> : <MapPin size={14} strokeWidth={2} />}
            </span>
            <div>
              <strong>{point.name}</strong>
              <small>{point.detail}</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
