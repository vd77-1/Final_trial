import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/trishna/AdminShell";
import { FilterBadge, RiskBadge } from "@/components/trishna/Panels";
import { StatusPill } from "@/components/trishna/StatusPill";
import { Input } from "@/components/ui/input";
import { statusMeta, type BoothStatus } from "@/data/types";
import { useFleetAnalytics } from "@/hooks/useTelemetry";
import { selectClass, timeAgo } from "@/lib/boothUtils";

export const Route = createFileRoute("/admin/booths")({
  head: () => ({
    meta: [{ title: "Booths — TRISHNA Control Centre" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminShell>
      <BoothsPage />
    </AdminShell>
  ),
});

const order = { critical: 0, unavailable: 1, attention: 2, offline: 3, operational: 4 } as const;

function BoothsPage() {
  const { rows, loading, error } = useFleetAnalytics();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BoothStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [risk, setRisk] = useState("all");

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          const s = q.trim().toLowerCase();
          return (
            (!s ||
              r.booth.id.toLowerCase().includes(s) ||
              r.booth.location.toLowerCase().includes(s) ||
              r.booth.building.toLowerCase().includes(s)) &&
            (status === "all" || r.displayStatus === status) &&
            (category === "all" || r.booth.category === category) &&
            (risk === "all" || r.risk.level === risk)
          );
        })
        .sort(
          (a, b) =>
            order[a.displayStatus] - order[b.displayStatus] || a.booth.id.localeCompare(b.booth.id),
        ),
    [rows, q, status, category, risk],
  );

  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <h1 className="font-display text-2xl font-bold text-primary">Booths</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, location, building"
            className="h-10 pl-9"
            aria-label="Search booths"
          />
        </div>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as BoothStatus | "all")}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {(Object.keys(statusMeta) as BoothStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusMeta[s].short}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {["Academic", "Hostel", "Library", "Administrative", "Common Area"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          aria-label="Filter by risk"
        >
          <option value="all">Any risk</option>
          {["High", "Medium", "Low"].map((c) => (
            <option key={c} value={c}>
              {c} risk
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-foreground"
        >
          {error}
        </p>
      )}

      <div className="card-elevated mt-4 overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Booth", "Status", "TDS", "pH", "Flow", "Last seen", "Risk", "Filter", "Open"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground" role="status">
                  Loading sensor data…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  No booths match these filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.booth.id} className="hover:bg-surface/60">
                <td className="px-4 py-3">
                  <Link
                    to="/admin/booth/$id"
                    params={{ id: r.booth.id }}
                    className="font-display font-bold text-primary hover:underline"
                  >
                    {r.booth.id}
                  </Link>
                  <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {r.booth.location}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={r.displayStatus} size="sm" />
                </td>
                <td className="px-4 py-3">{r.latest ? `${r.latest.tdsPpm} ppm` : "–"}</td>
                <td className="px-4 py-3">{r.latest ? r.latest.ph.toFixed(2) : "–"}</td>
                <td className="px-4 py-3">
                  {r.latest ? `${r.latest.flowLpm.toFixed(1)} L/min` : "–"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(r.latest?.ts)}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={r.risk.level} />
                </td>
                <td className="px-4 py-3">
                  <FilterBadge status={r.filter.status} />
                </td>
                <td className="px-4 py-3">{r.openComplaints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Readings are simulated. Risk is a demonstration estimate. Filter status is an estimate from
        rated capacity and service interval.
      </p>
    </div>
  );
}
