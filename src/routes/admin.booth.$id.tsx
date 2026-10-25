import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ClipboardCheck, MapPin, Pencil, QrCode, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/trishna/AdminShell";
import { FilterPanel, QualityNote, RiskPanel, Stat } from "@/components/trishna/Panels";
import { QrDialog } from "@/components/trishna/QrDialog";
import { ReplaceFilterDialog } from "@/components/trishna/ReplaceFilterDialog";
import { SensorChart } from "@/components/trishna/SensorChart";
import { SourceBadge } from "@/components/trishna/DataModeBanner";
import { StatusPill } from "@/components/trishna/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Booth, BoothCategory, BoothStatus } from "@/data/types";
import { statusMeta } from "@/data/types";
import { flowBaseline } from "@/domain/telemetry";
import { PH_MAX, PH_MIN, TDS_ACCEPTABLE } from "@/domain/thresholds";
import { useBoothAnalytics } from "@/hooks/useTelemetry";
import { fmtDate, fmtDateTime, nameOf, selectClass, timeAgo } from "@/lib/boothUtils";
import { editBooth, logInspection, setBoothStatus } from "@/services/actions";
import { useAuth } from "@/services/auth";
import { useBooth, useComplaints, useHistory, useUsers } from "@/services/store";

export const Route = createFileRoute("/admin/booth/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Booth ${params.id} — TRISHNA Control Centre` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <BoothPage />
    </AdminShell>
  ),
});

const STATUSES: BoothStatus[] = ["operational", "attention", "unavailable", "critical"];
const CATEGORIES: BoothCategory[] = [
  "Academic",
  "Hostel",
  "Library",
  "Administrative",
  "Common Area",
];

function BoothPage() {
  const { id } = Route.useParams();
  const { booth, loaded } = useBooth(id);
  if (!booth) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <h1 className="font-display text-2xl font-bold text-primary">
          {loaded ? `Booth "${id}" not found` : "Loading booth…"}
        </h1>
        {loaded && (
          <Button asChild className="mt-6">
            <Link to="/admin/dashboard">Back to dashboard</Link>
          </Button>
        )}
      </div>
    );
  }
  return <BoothDetail booth={booth} />;
}

function BoothDetail({ booth }: { booth: Booth }) {
  const { user } = useAuth();
  const users = useUsers();
  const { analytics, loading, error } = useBoothAnalytics(booth);
  const complaints = useComplaints()
    .filter((c) => c.boothId === booth.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const history = useHistory()
    .filter((h) => h.boothId === booth.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const [qr, setQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [note, setNote] = useState("");

  const status = analytics?.displayStatus ?? booth.status;
  const latest = analytics?.latest;
  const readings = analytics?.readings ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-primary">Booth {booth.id}</h1>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {booth.location} · {booth.building} · {booth.floor}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setQr(true)}>
            <QrCode className="mr-2 h-4 w-4" /> QR
          </Button>
          <Button variant="outline" asChild>
            <Link to="/booth/$id" params={{ id: booth.id }}>
              Public page
            </Link>
          </Button>
          <Button onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit / set status
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-foreground"
        >
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="TDS"
              value={latest ? `${latest.tdsPpm} ppm` : "–"}
              sub={`ref ≤ ${TDS_ACCEPTABLE}`}
              tone={latest && latest.tdsPpm > TDS_ACCEPTABLE ? "warn" : undefined}
            />
            <Stat
              label="pH"
              value={latest ? latest.ph.toFixed(2) : "–"}
              sub={`ref ${PH_MIN}–${PH_MAX}`}
              tone={latest && (latest.ph < PH_MIN || latest.ph > PH_MAX) ? "warn" : undefined}
            />
            <Stat
              label="Temperature"
              value={latest ? `${latest.temperatureC.toFixed(1)} °C` : "–"}
            />
            <Stat label="Flow" value={latest ? `${latest.flowLpm.toFixed(1)} L/min` : "–"} />
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Last reading:{" "}
            {latest
              ? `${fmtDateTime(latest.ts)} (${timeAgo(latest.ts)})`
              : loading
                ? "loading…"
                : "none"}{" "}
            <SourceBadge source={latest?.source} />
          </p>
          {loading && !analytics ? (
            <div className="h-48 animate-pulse rounded-2xl bg-card" aria-busy />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <SensorChart
                title="TDS"
                readings={readings}
                field="tdsPpm"
                unit="ppm"
                color="var(--aqua)"
                refs={[{ y: TDS_ACCEPTABLE, label: "500 ref" }]}
              />
              <SensorChart
                title="pH"
                readings={readings}
                field="ph"
                unit="pH"
                color="var(--teal)"
                refs={[
                  { y: PH_MIN, label: "6.5" },
                  { y: PH_MAX, label: "8.5" },
                ]}
              />
              <SensorChart
                title="Flow rate"
                readings={readings}
                field="flowLpm"
                unit="L/min"
                color="var(--primary)"
                baseline={flowBaseline(readings)}
              />
              <SensorChart
                title="Water temperature"
                readings={readings}
                field="temperatureC"
                unit="°C"
                color="var(--chart-4)"
              />
            </div>
          )}
          {analytics && (
            <section className="card-elevated p-5">
              <h2 className="mb-3 text-sm font-semibold">Water-quality monitoring</h2>
              <QualityNote q={analytics.quality} />
            </section>
          )}

          <section className="card-elevated p-5">
            <h2 className="text-sm font-semibold">Complaints ({complaints.length})</h2>
            {complaints.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No complaints logged for this booth.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {complaints.map((c) => (
                  <li key={c.id} className="rounded-xl bg-surface p-3 text-sm">
                    <p className="font-semibold">
                      {c.category}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {c.status}
                      </span>
                    </p>
                    <p className="text-muted-foreground">{c.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.id} · {fmtDateTime(c.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {analytics && <RiskPanel risk={analytics.risk} />}
          {analytics && (
            <FilterPanel
              filter={booth.filter}
              est={analytics.filter}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setReplacing(true)}
                >
                  <Wrench className="mr-2 h-4 w-4" /> Record filter replacement
                </Button>
              }
            />
          )}
          <section className="card-elevated p-5">
            <h2 className="text-sm font-semibold">Operations</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Category", booth.category],
                ["Assigned MTS", nameOf(users, booth.assignedMts)],
                ["Last maintenance", fmtDate(booth.lastMaintenanceAt)],
                ["Last verified", fmtDate(booth.lastVerifiedAt)],
                ["Workflow status", statusMeta[booth.status].short],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-4 border-b border-border pb-2 last:border-0"
                >
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card-elevated p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-aqua" /> Maintenance history
            </h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await logInspection(booth.id, user!.id, note);
                  setNote("");
                  toast.success("Inspection logged");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't save");
                }
              }}
            >
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Log an inspection note"
                aria-label="Inspection note"
                className="h-9"
              />
              <Button type="submit" size="sm">
                Log
              </Button>
            </form>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No maintenance recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-xl bg-surface p-3 text-sm">
                    <p className="font-semibold capitalize">{h.type.replace("-", " ")}</p>
                    <p className="text-muted-foreground">{h.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(h.at)} · {nameOf(users, h.by)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <QrDialog booth={qr ? booth : null} onClose={() => setQr(false)} />
      <ReplaceFilterDialog booth={replacing ? booth : null} onClose={() => setReplacing(false)} />
      <EditDialog booth={editing ? booth : null} onClose={() => setEditing(false)} />
    </div>
  );
}

function EditDialog({ booth, onClose }: { booth: Booth | null; onClose: () => void }) {
  const users = useUsers().filter((u) => u.role === "mts");
  const [f, setF] = useState({
    location: "",
    building: "",
    floor: "",
    category: "Academic" as BoothCategory,
    status: "operational" as BoothStatus,
    assignedMts: "",
  });
  const [err, setErr] = useState("");
  useEffect(() => {
    if (booth) {
      setF({
        location: booth.location,
        building: booth.building,
        floor: booth.floor,
        category: booth.category,
        status: booth.status === "offline" ? "operational" : booth.status,
        assignedMts: booth.assignedMts ?? "",
      });
      setErr("");
    }
  }, [booth]);
  return (
    <Dialog open={!!booth} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit booth {booth?.id}</DialogTitle>
          <DialogDescription>
            Changing the status here overrides the workflow status. "Offline" is set automatically
            when sensor data goes stale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="e-loc">Location</Label>
            <Input
              id="e-loc"
              className="mt-1"
              value={f.location}
              onChange={(e) => setF({ ...f, location: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="e-b">Building</Label>
              <Input
                id="e-b"
                className="mt-1"
                value={f.building}
                onChange={(e) => setF({ ...f, building: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="e-f">Floor</Label>
              <Input
                id="e-f"
                className="mt-1"
                value={f.floor}
                onChange={(e) => setF({ ...f, floor: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="e-c">Category</Label>
              <select
                id="e-c"
                className={`${selectClass} mt-1`}
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value as BoothCategory })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="e-s">Operational status</Label>
              <select
                id="e-s"
                className={`${selectClass} mt-1`}
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value as BoothStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusMeta[s].short}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="e-m">Assigned MTS</Label>
            <select
              id="e-m"
              className={`${selectClass} mt-1`}
              value={f.assignedMts}
              onChange={(e) => setF({ ...f, assignedMts: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          {err && (
            <p role="alert" className="text-sm text-crit">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!booth) return;
              try {
                await editBooth(booth.id, {
                  id: booth.id,
                  ...f,
                  assignedMts: f.assignedMts || undefined,
                  lat: booth.lat,
                  lng: booth.lng,
                });
                if (f.status !== booth.status) await setBoothStatus(booth.id, f.status);
                toast.success("Booth updated");
                onClose();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Couldn't save");
              }
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
