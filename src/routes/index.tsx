import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BrainCircuit,
  Droplets,
  Gauge,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import heroImage from "@/assets/hero-booth.jpg";
import { DataModeBanner } from "@/components/trishna/DataModeBanner";
import { PublicLayout } from "@/components/trishna/PublicLayout";
import { Button } from "@/components/ui/button";
import { useLiveBooths } from "@/hooks/useTelemetry";
import { statusMeta, type BoothStatus } from "@/data/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TRISHNA — Smart Water. Smarter Campus. | IIT (BHU)" },
      {
        name: "description",
        content:
          "Check live status and water quality of drinking-water booths across IIT (BHU), Varanasi. Scan, view status, report issues.",
      },
      { property: "og:title", content: "TRISHNA — Smart Water. Smarter Campus." },
      {
        property: "og:description",
        content: "Smart campus drinking-water monitoring for IIT (BHU), Varanasi.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Activity,
    title: "Check Water Status",
    text: "See whether a booth is operational before you walk across campus.",
  },
  {
    icon: Gauge,
    title: "Monitored Readings",
    text: "TDS, pH, temperature and flow, with the monitoring ranges they are checked against.",
  },
  {
    icon: TriangleAlert,
    title: "Report a Problem",
    text: "Flag a faulty cooler in seconds — no account needed.",
  },
  {
    icon: MapPin,
    title: "Find the Nearest Booth",
    text: "Locate the closest working drinking-water point around you.",
  },
];

const steps = [
  { icon: QrCode, title: "QR code on booth", text: "Every cooler carries a unique TRISHNA code." },
  { icon: ScanLine, title: "Scan", text: "Open the booth page instantly on your phone." },
  {
    icon: Droplets,
    title: "View current status",
    text: "Availability, quality and last verification.",
  },
  {
    icon: TriangleAlert,
    title: "Report if needed",
    text: "One tap sends the issue to campus maintenance.",
  },
];

function Landing() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-hero-gradient">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-card">
              <ShieldCheck className="h-3.5 w-3.5" /> IIT (BHU) Varanasi
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] text-primary sm:text-6xl">
              TRISHNA
            </h1>
            <p className="mt-3 text-xl font-semibold text-brand-gradient sm:text-2xl">
              Smart Water. Smarter Campus.
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              TRISHNA lets students, staff and visitors check the operational status and
              water-quality information of drinking-water booths across the campus — from academic
              departments and hostels to the Central Library. Scan the code on any cooler and know
              before you drink.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/scan">
                  <ScanLine className="mr-2 h-4 w-4" /> Scan QR / Enter Code
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/find" search={{}}>
                  Find a Water Booth
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/report" search={{}}>
                  <TriangleAlert className="mr-2 h-4 w-4" /> Report an Issue
                </Link>
              </Button>
            </div>
            <p className="mt-5 text-xs uppercase tracking-wider text-muted-foreground">
              Tracking &amp; Reporting Infrastructure for Safe Hydration Network Access
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-aqua/10 blur-2xl" aria-hidden />
            <img
              src={heroImage}
              alt="Smart campus drinking-water booth with sensor display, QR code and connectivity indicators"
              width={1280}
              height={1024}
              className="relative w-full rounded-3xl border border-border bg-card shadow-float"
            />
          </div>
        </div>
      </section>

      <CampusOverview />

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card-elevated p-6 transition-shadow hover:shadow-float">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-aqua-gradient text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold text-primary">How TRISHNA works</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Designed around the way people actually use a water cooler: walk up, scan, decide.
          </p>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="card-elevated relative p-6">
                <span className="absolute right-5 top-5 font-display text-3xl font-bold text-accent">
                  {i + 1}
                </span>
                <s.icon className="h-6 w-6 text-aqua" />
                <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-elevated p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ok">
              Working in this prototype
            </span>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>QR / booth-code lookup and a real IIT (BHU) map</li>
              <li>Issue reporting, tracking, admin verification and maintenance workflow</li>
              <li>Simulated sensor data with 24-hour and 7-day trends</li>
              <li>Filter-life estimates and rules-based maintenance risk, with reasons</li>
            </ul>
          </div>
          <div className="card-elevated p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
              <BrainCircuit className="h-3.5 w-3.5" /> Planned, not yet connected
            </span>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>ESP32 gateways with TDS, pH, temperature and flow sensors on each booth</li>
              <li>A trained machine-learning model replacing the demonstration rules</li>
              <li>Laboratory testing for contaminants these sensors cannot detect</li>
            </ul>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

const tiles: { key: string; label: string; match: (s: BoothStatus) => boolean }[] = [
  { key: "ok", label: "Normal", match: (s) => s === "operational" },
  {
    key: "attn",
    label: "Attention needed",
    match: (s) => s === "attention" || s === "unavailable",
  },
  { key: "bad", label: "Not working", match: (s) => s === "critical" },
  { key: "off", label: "Offline / no recent data", match: (s) => s === "offline" },
];

function CampusOverview() {
  const { booths, telemetryLoaded } = useLiveBooths();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6" aria-labelledby="overview-h">
      <h2 id="overview-h" className="text-xl font-bold text-primary">
        Campus water status
      </h2>
      <DataModeBanner className="mt-3" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const n = booths.filter((b) => t.match(b.displayStatus)).length;
          const dot =
            t.key === "ok"
              ? statusMeta.operational.dot
              : t.key === "attn"
                ? statusMeta.attention.dot
                : t.key === "bad"
                  ? statusMeta.critical.dot
                  : statusMeta.offline.dot;
          return (
            <div key={t.key} className="card-elevated px-5 py-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> {t.label}
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">
                {booths.length ? n : "–"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {booths.length ? `${booths.length} registered booths.` : "Loading booths…"}{" "}
        {booths.length > 0 && !telemetryLoaded && "Checking sensor data…"}
      </p>
    </section>
  );
}
