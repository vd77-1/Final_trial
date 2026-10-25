import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup, Marker, CircleMarker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { CAMPUS_CENTER } from "@/data/booths";
import { statusMeta, type Booth, type BoothStatus } from "@/data/types";
import { cn } from "@/lib/utils";

type LatLng = { lat: number; lng: number };

type MapBooth = Booth & { displayStatus?: BoothStatus | undefined };

type Props = {
  booths: MapBooth[];
  selectedId?: string | undefined;
  onSelect?: ((booth: MapBooth) => void) | undefined;
  className?: string | undefined;
  /** Enables "click the map to choose a spot" (used when adding a booth). */
  onMapClick?: ((point: LatLng) => void) | undefined;
  /** Marker for the spot chosen but not yet saved. */
  pending?: LatLng | null | undefined;
  /** Lets booth markers be dragged to fine-tune their position. */
  editable?: boolean | undefined;
  onMove?: ((id: string, point: LatLng) => void) | undefined;
  /** The viewer's own position (blue dot). */
  userLocation?: LatLng | null | undefined;
};

/** Real OpenStreetMap / satellite map of IIT (BHU) with one marker per booth. */
export function CampusMap({
  booths,
  selectedId,
  onSelect,
  className,
  onMapClick,
  pending,
  editable,
  onMove,
  userLocation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const pendingRef = useRef<Marker | null>(null);
  const userRef = useRef<CircleMarker | null>(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // keep latest callbacks without recreating the map
  const cb = useRef({ onSelect, onMapClick, onMove });
  cb.current = { onSelect, onMapClick, onMove };

  // 1. create the map once (client only)
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng],
        zoom: 16,
        minZoom: 13,
        zoomControl: true,
      });

      const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles &copy; Esri" },
      );
      L.control
        .layers({ Map: street, Satellite: satellite }, undefined, { position: "topright" })
        .addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e) => cb.current.onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));

      mapRef.current = map;
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
      pendingRef.current = null;
      userRef.current = null;
      fittedRef.current = false;
      setReady(false);
    };
  }, []);

  // 2. (re)draw booth markers
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    markersRef.current.clear();

    booths.forEach((b) => {
      const active = selectedId === b.id;
      const st = b.displayStatus ?? b.status;
      const color = statusMeta[st].color;
      const icon = L.divIcon({
        className: "",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        html: `<span style="display:block;width:${active ? 26 : 20}px;height:${active ? 26 : 20}px;margin:${
          active ? 0 : 3
        }px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);${
          active ? "outline:3px solid #0b3c5d;" : ""
        }${st === "critical" ? "animation:pulse-crit 1.8s ease-in-out infinite;" : ""}"></span>`,
      });
      const marker = L.marker([b.lat, b.lng], {
        icon,
        draggable: !!editable,
        keyboard: true,
        title: `${b.id} · ${b.location}`,
        zIndexOffset: active ? 1000 : 0,
      });
      marker.bindTooltip(`${b.id} · ${statusMeta[st].short}`, {
        direction: "top",
        offset: [0, -10],
      });
      marker.on("click", () => cb.current.onSelect?.(b));
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        cb.current.onMove?.(b.id, { lat: p.lat, lng: p.lng });
      });
      marker.addTo(layer);
      markersRef.current.set(b.id, marker);
    });

    if (!fittedRef.current && booths.length > 0) {
      fittedRef.current = true;
      const bounds = L.latLngBounds(booths.map((b) => [b.lat, b.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [ready, booths, selectedId, editable]);

  // 3. pan to the selected booth
  useEffect(() => {
    if (!ready || !selectedId) return;
    const m = markersRef.current.get(selectedId);
    if (m) mapRef.current?.panTo(m.getLatLng(), { animate: true });
  }, [ready, selectedId]);

  // 4. pending (not yet saved) booth position
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    pendingRef.current?.remove();
    pendingRef.current = null;
    if (pending) {
      pendingRef.current = L.marker([pending.lat, pending.lng], {
        icon: L.divIcon({
          className: "",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#0b3c5d;color:#fff;font-weight:700;font-size:18px;border:3px solid #fff;box-shadow:0 1px 8px rgba(0,0,0,.5)">+</span>`,
        }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(map);
    }
  }, [ready, pending]);

  // 5. the viewer's own location
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    userRef.current?.remove();
    userRef.current = null;
    if (userLocation) {
      userRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .bindTooltip("You are here")
        .addTo(map);
    }
  }, [ready, userLocation]);

  return (
    <div
      className={cn(
        "relative isolate h-full min-h-[260px] w-full overflow-hidden rounded-2xl border border-border bg-surface",
        className,
      )}
      role="group"
      aria-label="IIT (BHU) campus water booth map"
    >
      <div
        ref={containerRef}
        className={cn("absolute inset-0 z-0", onMapClick && "cursor-crosshair")}
      />

      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
          Loading map…
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-3 z-[500] flex flex-wrap gap-3 rounded-xl border border-border bg-card/90 px-3 py-2 text-[11px] font-medium shadow-card backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ok" /> Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warn" /> Attention
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-crit" /> Not working
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Offline
        </span>
      </div>
    </div>
  );
}
