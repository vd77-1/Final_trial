import type { BoothStatus } from "@/data/types";

/** Accepts a raw code ("B-17"), "TRISHNA:B-17", or a URL ending in /booth/B-17. */
export function parseBoothCode(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const fromUrl = t.match(/\/booth\/([^/?#\s]+)/i);
  if (fromUrl?.[1]) return decodeURIComponent(fromUrl[1]);
  const prefixed = t.match(/^trishna[:\s]+(.+)$/i);
  if (prefixed?.[1]) return prefixed[1].trim();
  return t;
}

/** Great-circle distance in metres. */
export function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

/** Walking directions link (opens the maps app). `from` is optional. */
export function directionsUrl(
  to: { lat: number; lng: number },
  from?: { lat: number; lng: number } | null,
) {
  const base = `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=walking`;
  return from ? `${base}&origin=${from.lat},${from.lng}` : base;
}

export type Availability = "available" | "unavailable" | "unknown";
export function availability(status: BoothStatus): Availability {
  if (status === "operational" || status === "attention") return "available";
  if (status === "offline") return "unknown";
  return "unavailable";
}

export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export function timeAgo(iso?: string | null, nowMs = Date.now()): string {
  if (!iso) return "never";
  const m = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const nameOf = (users: { id: string; name: string }[], id: string | undefined) =>
  (id && users.find((u) => u.id === id)?.name) || "Unassigned";

export const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
