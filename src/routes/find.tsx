import { createFileRoute, Link } from "@tanstack/react-router";
import { Crosshair, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CampusMap } from "@/components/trishna/CampusMap";
import { DataModeBanner } from "@/components/trishna/DataModeBanner";
import { PublicLayout } from "@/components/trishna/PublicLayout";
import { StatusPill } from "@/components/trishna/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { boothKey } from "@/data/booths";
import { useLiveBooths } from "@/hooks/useTelemetry";
import { availability, directionsUrl, distanceMetres, formatDistance } from "@/lib/boothUtils";

export const Route = createFileRoute("/find")({
  validateSearch: (s: Record<string, unknown>): { from?: string; ok?: boolean } => ({
    ...(typeof s["from"] === "string" ? { from: s["from"] } : {}),
    ...(s["ok"] === true || s["ok"] === "true" ? { ok: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Find a Water Booth — TRISHNA" },
      {
        name: "description",
        content:
          "Find drinking-water booths on the IIT (BHU) campus with distance, directions and status.",
      },
    ],
  }),
  component: FindPage,
});

const filters = ["All", "Operational only", "Academic", "Hostel", "Library"] as const;
type Point = { lat: number; lng: number };

function FindPage() {
  const search = Route.useSearch();
  const { booths, telemetryError } = useLiveBooths();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>(
    search.ok ? "Operational only" : "All",
  );
  const [selected, setSelected] = useState<string | undefined>();
  // Where the distances are measured from. Never guessed: it is either the device location
  // (after the user taps the button) or a booth the user says they are standing near.
  const [me, setMe] = useState<Point | null>(null);
  const [nearId, setNearId] = useState(search.from ?? "");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  const nearBooth = booths.find((b) => boothKey(b.id) === boothKey(nearId));
  const origin: Point | null =
    me ?? (nearBooth ? { lat: nearBooth.lat, lng: nearBooth.lng } : null);
  const originLabel = me ? "your current location" : nearBooth ? `booth ${nearBooth.id}` : null;

  function locate() {
    if (!("geolocation" in navigator))
      return setLocError(
        "Location isn't available in this browser. Choose a nearby booth below instead.",
      );
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearId("");
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can pick a nearby booth below to measure from instead."
            : "Couldn't get your location. Pick a nearby booth below instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return booths
      .map((b) => ({
        ...b,
        distance: origin ? distanceMetres(origin.lat, origin.lng, b.lat, b.lng) : null,
      }))
      .filter((b) => {
        const matches =
          !q ||
          b.id.toLowerCase().includes(q) ||
          b.location.toLowerCase().includes(q) ||
          b.building.toLowerCase().includes(q);
        const cat =
          filter === "All" ||
          (filter === "Operational only" && b.displayStatus === "operational") ||
          b.category === filter;
        return matches && cat;
      })
      .sort((a, b) =>
        a.distance !== null && b.distance !== null
          ? a.distance - b.distance
          : a.id.localeCompare(b.id),
      );
  }, [booths, query, filter, origin?.lat, origin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl font-bold text-primary">Find a water booth</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground" aria-live="polite">
          {originLabel
            ? `Sorted by distance from ${originLabel}.`
            : "Share your location, or choose a booth you are standing near, to sort by distance. Until then booths are listed by ID."}
        </p>
        <DataModeBanner className="mt-4" />
        {telemetryError && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-foreground"
          >
            {telemetryError}
          </p>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Button variant="outline" size="lg" onClick={locate} disabled={locating}>
            {locating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="mr-2 h-4 w-4" />
            )}
            Use my location
          </Button>
          <span className="self-center text-center text-xs font-semibold uppercase text-muted-foreground">
            or
          </span>
          <div>
            <label htmlFor="near" className="sr-only">
              I am near booth
            </label>
            <select
              id="near"
              value={nearBooth?.id ?? ""}
              onChange={(e) => {
                setNearId(e.target.value);
                setMe(null);
                setLocError("");
              }}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">I'm standing near booth…</option>
              {[...booths]
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} · {b.location}
                  </option>
                ))}
            </select>
          </div>
        </div>
        {locError && (
          <p role="alert" className="mt-2 text-xs text-crit">
            {locError}
          </p>
        )}

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search department, hostel or booth ID"
            className="h-11 pl-9"
            aria-label="Search booths"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="order-2 space-y-3 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {results.length} booth{results.length === 1 ? "" : "s"}
            </p>
            <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {results.map((b) => {
                const av = availability(b.displayStatus);
                return (
                  <article
                    key={b.id}
                    onMouseEnter={() => setSelected(b.id)}
                    className="card-elevated flex flex-wrap items-center gap-4 p-4 transition-shadow hover:shadow-float"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-base font-bold text-primary">
                          Booth {b.id}
                        </h2>
                        <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                          {b.category}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{b.location}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-aqua" />
                        {b.distance !== null ? `${formatDistance(b.distance)} away · ` : ""}
                        {av === "available"
                          ? "Water available"
                          : av === "unavailable"
                            ? "No water"
                            : "Status unknown"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={b.displayStatus} size="sm" />
                      <Button asChild size="sm" variant="outline">
                        <Link to="/booth/$id" params={{ id: b.id }}>
                          View
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <a
                          href={directionsUrl(b, me)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Directions to booth ${b.id}`}
                        >
                          <Navigation className="mr-1 h-4 w-4" /> Directions
                        </a>
                      </Button>
                    </div>
                  </article>
                );
              })}
              {results.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No booths match your search.
                </p>
              )}
            </div>
          </div>
          <div className="order-1 h-[320px] lg:order-2 lg:sticky lg:top-24 lg:h-[560px]">
            <CampusMap
              booths={results}
              selectedId={selected}
              onSelect={(b) => setSelected(b.id)}
              userLocation={me}
            />
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
