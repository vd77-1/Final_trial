import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Droplets,
  FlaskConical,
  Gauge,
  Info,
  MapPin,
  Navigation,
  ScanLine,
  Thermometer,
  TriangleAlert,
} from "lucide-react";
import { DataModeBanner, SourceBadge } from "@/components/trishna/DataModeBanner";
import { QualityNote, Stat } from "@/components/trishna/Panels";
import { PublicLayout } from "@/components/trishna/PublicLayout";
import { SensorChart } from "@/components/trishna/SensorChart";
import { StatusPill } from "@/components/trishna/StatusPill";
import { Button } from "@/components/ui/button";
import { statusMeta, type BoothStatus } from "@/data/types";
import { flowBaseline } from "@/domain/telemetry";
import { PH_MAX, PH_MIN, TDS_ACCEPTABLE, phTone, tdsTone } from "@/domain/thresholds";
import { useBoothAnalytics } from "@/hooks/useTelemetry";
import { availability, fmtDateTime, timeAgo } from "@/lib/boothUtils";
import { useBooth } from "@/services/store";

export const Route = createFileRoute("/booth/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Booth ${params.id} — Status | TRISHNA` },
      {
        name: "description",
        content: `Status, water availability and monitored readings for booth ${params.id} at IIT (BHU).`,
      },
    ],
  }),
  component: BoothStatusPage,
});

const banner: Record<BoothStatus, string> = {
  operational: "bg-ok-soft border-ok/25",
  critical: "bg-crit-soft border-crit/25",
  attention: "bg-warn-soft border-warn/30",
  unavailable: "bg-warn-soft border-warn/30",
  offline: "bg-muted border-border",
};

const headline: Record<BoothStatus, string> = {
  operational: "Operational",
  attention: "Working, but attention needed",
  unavailable: "No water right now",
  critical: "Not working",
  offline: "No recent data from this booth",
};

function BoothStatusPage() {
  const { id } = Route.useParams();
  const { booth, loaded } = useBooth(id);
  const { analytics, loading, error } = useBoothAnalytics(booth);

  if (!booth) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-xl px-4 py-20 text-center sm:px-6">
          {loaded ? (
            <>
              <h1 className="font-display text-2xl font-bold text-primary">
                Booth "{id}" not found
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Check the code printed on the booth, or scan its QR code again.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/scan">
                    <ScanLine className="mr-2 h-4 w-4" /> Scan / enter code
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/find">Find a booth</Link>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Loading booth…
            </p>
          )}
        </div>
      </PublicLayout>
    );
  }

  const status: BoothStatus = analytics?.displayStatus ?? booth.status;
  const avail = availability(status);
  const latest = analytics?.latest;
  const stale = analytics?.stale ?? false;
  const recent = analytics ? analytics.readings.slice(-6).reverse() : [];

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Booth</span>
          <span className="rounded-md bg-accent px-2 py-0.5 text-accent-foreground">
            {booth.id}
          </span>
          <span>· {booth.category}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold text-primary sm:text-3xl">
          {booth.location}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {booth.building} · {booth.floor}
        </p>

        <DataModeBanner className="mt-5" />

        <div className={`mt-5 rounded-2xl border p-6 shadow-card ${banner[status]}`}>
          <StatusPill status={status} size="lg" />
          <p className="mt-4 font-display text-2xl font-bold text-primary sm:text-3xl">
            {headline[status]}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Water availability
              </p>
              <p
                className={`mt-1 text-lg font-bold ${
                  avail === "available"
                    ? "text-ok"
                    : avail === "unavailable"
                      ? "text-crit"
                      : "text-muted-foreground"
                }`}
              >
                {avail === "available"
                  ? "Water available"
                  : avail === "unavailable"
                    ? "Water unavailable"
                    : "Unknown (no recent data)"}
              </p>
            </div>
            <div className="rounded-xl bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Last updated
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {latest
                  ? `${fmtDateTime(latest.ts)} (${timeAgo(latest.ts)})`
                  : loading
                    ? "Loading…"
                    : "No readings yet"}
                <SourceBadge source={latest?.source} />
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Status is set by campus maintenance after reports are reviewed (
            {statusMeta[status].short}).
          </p>
        </div>

        <section className="card-elevated mt-6 p-6">
          <h2 className="text-base font-semibold">Monitored readings</h2>
          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-foreground"
            >
              {error}
            </p>
          )}
          {loading && !analytics ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : latest ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="TDS"
                value={`${latest.tdsPpm} ppm`}
                tone={tdsTone(latest.tdsPpm) === "ok" ? "ok" : "warn"}
                sub={`reference ≤ ${TDS_ACCEPTABLE}`}
                icon={<Droplets className="h-4 w-4 text-aqua" />}
              />
              <Stat
                label="pH"
                value={latest.ph.toFixed(2)}
                tone={phTone(latest.ph) === "ok" ? "ok" : "warn"}
                sub={`reference ${PH_MIN}–${PH_MAX}`}
                icon={<FlaskConical className="h-4 w-4 text-aqua" />}
              />
              <Stat
                label="Temperature"
                value={`${latest.temperatureC.toFixed(1)} °C`}
                sub="water at outlet"
                icon={<Thermometer className="h-4 w-4 text-aqua" />}
              />
              <Stat
                label="Flow"
                value={`${latest.flowLpm.toFixed(1)} L/min`}
                sub="at last reading"
                icon={<Gauge className="h-4 w-4 text-aqua" />}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No sensor readings are available for this booth yet.
            </p>
          )}
          {analytics && (
            <div className="mt-4">
              <QualityNote q={analytics.quality} />
              {stale && (
                <p className="mt-2 text-xs text-muted-foreground">
                  The latest reading is older than 6 hours, so quality is not assessed.
                </p>
              )}
            </div>
          )}
        </section>

        {analytics && analytics.readings.length > 0 && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SensorChart
                title="TDS"
                readings={analytics.readings}
                field="tdsPpm"
                unit="ppm"
                color="var(--aqua)"
                refs={[{ y: TDS_ACCEPTABLE, label: `${TDS_ACCEPTABLE} ppm ref` }]}
                compact
              />
              <SensorChart
                title="Flow rate"
                readings={analytics.readings}
                field="flowLpm"
                unit="L/min"
                color="var(--primary)"
                baseline={flowBaseline(analytics.readings)}
                compact
              />
            </div>
            <section className="card-elevated mt-4 overflow-x-auto p-5">
              <h3 className="text-sm font-semibold">Recent readings</h3>
              <table className="mt-3 w-full min-w-[420px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-semibold">Time</th>
                    <th className="pb-2 font-semibold">TDS (ppm)</th>
                    <th className="pb-2 font-semibold">pH</th>
                    <th className="pb-2 font-semibold">Temp (°C)</th>
                    <th className="pb-2 font-semibold">Flow (L/min)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((r) => (
                    <tr key={r.ts}>
                      <td className="py-1.5">{fmtDateTime(r.ts)}</td>
                      <td>{r.tdsPpm}</td>
                      <td>{r.ph.toFixed(2)}</td>
                      <td>{r.temperatureC.toFixed(1)}</td>
                      <td>{r.flowLpm.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg" variant={status === "operational" ? "outline" : "default"}>
            <Link to="/report" search={{ booth: booth.id }}>
              <TriangleAlert className="mr-2 h-4 w-4" />
              Report an Issue
            </Link>
          </Button>
          <Button asChild size="lg" variant={status === "operational" ? "default" : "outline"}>
            <Link to="/find" search={{ from: booth.id, ok: true }}>
              <Navigation className="mr-2 h-4 w-4" />
              Find Nearby Operational Booths
            </Link>
          </Button>
        </div>

        <p className="mt-8 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Readings are monitoring indicators for maintenance. They are not a certificate of water
          safety.
        </p>
      </div>
    </PublicLayout>
  );
}
