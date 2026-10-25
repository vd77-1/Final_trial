import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Move, Plus, QrCode, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CampusMap } from "@/components/trishna/CampusMap";
import { AdminShell } from "@/components/trishna/AdminShell";
import { QrDialog } from "@/components/trishna/QrDialog";
import { StatusDot } from "@/components/trishna/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusMeta, type Booth, type BoothCategory, type BoothStatus } from "@/data/types";
import { defaultFilter } from "@/data/filterDefaults";
import {
  addBooth,
  moveBooth,
  removeBooth,
  resetDemoData,
  setBoothStatus,
} from "@/services/actions";
import { isDemoMode } from "@/services/backend";
import { useBooths, useUsers } from "@/services/store";

/** Next free code in the P-nn series for prototype booths. */
function suggestBoothId(list: Booth[]): string {
  const used = list
    .filter((b) => /^P-?\d+$/i.test(b.id))
    .map((b) => Number(b.id.replace(/\D/g, "")));
  return `P-${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, "0")}`;
}

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Add & Manage Booths — TRISHNA" },
      {
        name: "description",
        content: "Add water booths on the IIT (BHU) map, set their status and print QR codes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <ManagePage />
    </AdminShell>
  ),
});

const categories: BoothCategory[] = [
  "Academic",
  "Hostel",
  "Library",
  "Administrative",
  "Common Area",
];
import { selectClass } from "@/lib/boothUtils";
const statuses: BoothStatus[] = ["operational", "attention", "unavailable", "critical"];

function ManagePage() {
  const booths = useBooths();
  const mtsUsers = useUsers().filter((u) => u.role === "mts");
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const [editable, setEditable] = useState(false);
  const [qrBooth, setQrBooth] = useState<Booth | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    id: "",
    location: "",
    building: "",
    floor: "Ground Floor",
    category: "Academic" as BoothCategory,
    status: "operational" as BoothStatus,
    assignedMts: "",
    filterType: "RO + UV purifier",
    ratedCapacityL: "36000",
    maxServiceDays: "180",
  });

  const suggestedId = useMemo(() => suggestBoothId(booths), [booths]);
  const sorted = useMemo(
    () =>
      [...booths].sort(
        (a, b) => Number(!!b.custom) - Number(!!a.custom) || a.id.localeCompare(b.id),
      ),
    [booths],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = (form.id || suggestedId).trim().toUpperCase();
    try {
      const booth = await addBooth({
        id,
        location: form.location,
        building: form.building,
        floor: form.floor,
        category: form.category,
        status: form.status,
        assignedMts: form.assignedMts || undefined,
        lat: pending?.lat ?? NaN,
        lng: pending?.lng ?? NaN,
        filter: {
          ...defaultFilter(id),
          type: form.filterType.trim() || "Purifier",
          ratedCapacityL: Number(form.ratedCapacityL),
          maxServiceDays: Number(form.maxServiceDays),
          processedL: 0,
          installedAt: new Date().toISOString(),
        },
      });
      setError("");
      setPending(null);
      setSelected(booth.id);
      setForm((f) => ({ ...f, id: "", location: "", building: "" }));
      toast.success(`Booth ${booth.id} added`);
      setQrBooth(booth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the booth.");
    }
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-display text-3xl font-bold text-primary">Add &amp; manage booths</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Click the map to drop a new booth, fill in the details, then print its QR code.
          {isDemoMode() ? " In demo mode booths are saved in this browser only." : ""}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <div className="h-[420px] lg:h-[560px]">
              <CampusMap
                booths={booths}
                selectedId={selected}
                onSelect={(b) => setSelected(b.id)}
                onMapClick={editable ? undefined : (p) => setPending(p)}
                pending={pending}
                editable={editable}
                onMove={(id, p) => {
                  moveBooth(id, p.lat, p.lng).then(
                    () => toast.success(`Moved ${id}`),
                    () => toast.error("Couldn't move the booth"),
                  );
                }}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editable}
                onChange={(e) => {
                  setEditable(e.target.checked);
                  setPending(null);
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <Move className="h-4 w-4 text-muted-foreground" />
              Drag existing booths to fix their position on the map
            </label>
          </div>

          <form onSubmit={submit} className="card-elevated space-y-4 p-5">
            <h2 className="font-display text-lg font-bold text-primary">New booth</h2>
            <p className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-aqua" />
              {pending
                ? `Location chosen: ${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`
                : editable
                  ? 'Turn off "drag booths" to place a new one.'
                  : "Click the map to choose the booth's location."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b-id">Booth code</Label>
                <Input
                  id="b-id"
                  className="mt-1 uppercase"
                  value={form.id}
                  placeholder={suggestedId}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="b-cat">Category</Label>
                <select
                  id="b-cat"
                  className={`${selectClass} mt-1`}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as BoothCategory })}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="b-loc">Location name</Label>
              <Input
                id="b-loc"
                className="mt-1"
                placeholder="e.g. Department of Electronics Engineering"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b-bld">Building</Label>
                <Input
                  id="b-bld"
                  className="mt-1"
                  value={form.building}
                  onChange={(e) => setForm({ ...form, building: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="b-floor">Floor</Label>
                <Input
                  id="b-floor"
                  className="mt-1"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="b-mts">Assigned MTS</Label>
              <select
                id="b-mts"
                className={`${selectClass} mt-1`}
                value={form.assignedMts}
                onChange={(e) => setForm({ ...form, assignedMts: e.target.value })}
              >
                <option value="">Unassigned</option>
                {mtsUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="rounded-xl border border-border p-3">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">
                Filter details
              </legend>
              <Input
                aria-label="Filter type"
                value={form.filterType}
                onChange={(e) => setForm({ ...form, filterType: e.target.value })}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="b-cap" className="text-xs">
                    Rated capacity (L)
                  </Label>
                  <Input
                    id="b-cap"
                    type="number"
                    min={1}
                    className="mt-1"
                    value={form.ratedCapacityL}
                    onChange={(e) => setForm({ ...form, ratedCapacityL: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="b-int" className="text-xs">
                    Service interval (days)
                  </Label>
                  <Input
                    id="b-int"
                    type="number"
                    min={1}
                    className="mt-1"
                    value={form.maxServiceDays}
                    onChange={(e) => setForm({ ...form, maxServiceDays: e.target.value })}
                  />
                </div>
              </div>
            </fieldset>
            <div>
              <Label htmlFor="b-status">Starting status</Label>
              <select
                id="b-status"
                className={`${selectClass} mt-1`}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as BoothStatus })}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {statusMeta[s].short}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-crit-soft px-3 py-2 text-sm text-crit">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add booth
            </Button>
          </form>
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-primary">
              All booths ({booths.length})
            </h2>
            {isDemoMode() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove added booths, reports and tasks, and restore the demo data?",
                    )
                  ) {
                    resetDemoData();
                    setPending(null);
                    toast.success("Demo data restored");
                  }
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reset demo data
              </Button>
            )}
          </div>
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {sorted.map((b) => (
              <li
                key={b.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${selected === b.id ? "bg-surface" : ""}`}
              >
                <StatusDot status={b.status} />
                <button
                  type="button"
                  onClick={() => setSelected(b.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-display text-sm font-bold text-primary">
                    {b.id}
                    {b.custom && (
                      <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase text-accent-foreground">
                        added
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{b.location}</p>
                </button>
                <select
                  aria-label={`Status of ${b.id}`}
                  className={`${selectClass} w-44`}
                  value={b.status}
                  onChange={(e) =>
                    setBoothStatus(b.id, e.target.value as BoothStatus).catch(() =>
                      toast.error("Couldn't update status"),
                    )
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {statusMeta[s].short}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => setQrBooth(b)}>
                  <QrCode className="mr-1.5 h-4 w-4" /> QR
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/booth/$id" params={{ id: b.id }}>
                    Open
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${b.id}`}
                  onClick={() => {
                    if (window.confirm(`Delete booth ${b.id}? This cannot be undone.`))
                      removeBooth(b.id).catch(() => toast.error("Couldn't delete the booth"));
                  }}
                >
                  <Trash2 className="h-4 w-4 text-crit" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <QrDialog booth={qrBooth} onClose={() => setQrBooth(null)} />
    </>
  );
}
