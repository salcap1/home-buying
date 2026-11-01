import type { Map as LeafletMap } from "leaflet";

type LeafletLike = {
  tileLayer: (
    url: string,
    options?: Record<string, unknown>
  ) => { addTo: (map: LeafletMap) => unknown };
};

export function addQuietTiles(L: LeafletLike, map: LeafletMap) {
  const opts = { attribution: "Tiles &copy; Esri", maxZoom: 16 };
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    opts
  ).addTo(map);
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    { ...opts, pane: "overlayPane" }
  ).addTo(map);
}
