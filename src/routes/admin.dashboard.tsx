import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  ClipboardList,
  Search,
  TriangleAlert,
  Waves,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/trishna/AdminShell";
import { CampusMap } from "@/components/trishna/CampusMap";
import { RiskBadge } from "@/components/trishna/Panels";
import { StatusDot } from "@/components/trishna/StatusPill";
import { Input } from "@/components/ui/input";
import { statusMeta } from "@/data/types";
import { useFleetAnalytics } from "@/hooks/useTelemetry";
import { isOpenComplaint } from "@/services/actions";
import { useComplaints, useTasks } from "@/services/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [{ title: "Admin Dashboard — TRISHNA" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminShell>
      <AdminDashboard />
    </AdminShell>
  ),
});

const order = { critical: 0, unavailable: 1, attention: 2, offline: 3, operational: 4 } as const;

function AdminDashboard() {
  const navigate = useNavigate();
  const { rows, loading, error } = useFleetAnalytics();
  const complaints = useComplaints();
  const tasks = useTasks();
  const [selected, setSelected] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  const total = rows.length;
  const count = (f: (s: string) => boolean) => rows.filter((r) => f(r.displayStatus)).length;
  const attention = rows.filter(
    (r) =>
      r.displayStatus !== "operational" || r.risk.level === "High" || r.filter.status !== "Normal",
  ).length;

  const cards = [
    {
      label: "Registered booths",
      value: total,
      icon: Waves,
      tone: "text-primary",
      bg: "bg-accent",
    },
    {
      label: "Operational",
      value: count((s) => s === "operational"),
      icon: Activity,
      tone: "text-ok",
      bg: "bg-ok-soft",
    },
    {
      label: "Non-operational",
      value: count((s) => s === "critical" || s === "unavailable"),
      icon: AlertOctagon,
      tone: "text-crit",
      bg: "bg-crit-soft",
      sub: "not working / no water",
    },
    {
      label: "Open complaints",
      value: complaints.filter(isOpenComplaint).length,
      icon: ClipboardList,
      tone: "text-warn-foreground",
      bg: "bg-warn-soft",
      to: "/admin/complaints",
    },
    {
      label: "Tasks in progress",
      value: tasks.filter((t) => t.status === "In Progress" || t.status === "Accepted").length,
      icon: Wrench,
      tone: "text-primary",
      bg: "bg-accent",
      to: "/admin/maintenance",
    },
    {
      label: "Need attention",
      value: attention,
      icon: TriangleAlert,
      tone: "text-warn-foreground",
      bg: "bg-warn-soft",
      sub: "status, risk or filter",
      to: "/admin/risk",
    },
  ] as const;

  const list = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            !query.trim() ||
            r.booth.id.toLowerCase().includes(query.toLowerCase()) ||
            r.booth.location.toLowerCase().includes(query.toLowerCase()),
        )
        .sort(
          (a, b) => order[a.displayStatus] - order[b.displayStatus] || b.risk.score - a.risk.score,
        ),
    [rows, query],
  );
  const mapBooths = rows.map((r) => ({ ...r.booth, displayStatus: r.displayStatus }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 lg:p-6">
      {error && (
        <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-foreground">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {cards.map((c) => {
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  c.bg,
                )}
              >
                <c.icon className={cn("h-5 w-5", c.tone)} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
                  {c.label}
                </p>
                <p className="font-display text-2xl font-bold leading-tight text-primary">
                  {loading && c.label !== "Open complaints" && c.label !== "Tasks in progress"
                    ? "–"
                    : c.value}
                </p>
              </div>
            </>
          );
          return "to" in c ? (
            <Link
              key={c.label}
              to={c.to}
              className="card-elevated flex items-center gap-3 px-4 py-3 transition-shadow hover:shadow-float"
            >
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="card-elevated flex items-center gap-3 px-4 py-3">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:h-[560px] lg:grid-cols-[minmax(0,3fr)_minmax(300px,1.1fr)]">
        <div className="h-[420px] lg:h-full">
          <CampusMap
            booths={mapBooths}
            selectedId={selected}
            onSelect={(b) => {
              setSelected(b.id);
              navigate({ to: "/admin/booth/$id", params: { id: b.id } });
            }}
            className="shadow-card"
          />
        </div>
        <aside className="card-elevated flex min-h-[320px] flex-col overflow-hidden lg:min-h-0">
          <div className="border-b border-border p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Water booths · worst first
            </h2>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search booths"
                className="h-9 pl-9 text-sm"
                aria-label="Search booths"
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {loading && (
              <li className="p-4 text-sm text-muted-foreground" role="status">
                Loading sensor data…
              </li>
            )}
            {list.map((r) => (
              <li key={r.booth.id}>
                <Link
                  to="/admin/booth/$id"
                  params={{ id: r.booth.id }}
                  onMouseEnter={() => setSelected(r.booth.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface",
                    selected === r.booth.id && "bg-surface",
                  )}
                >
                  <StatusDot status={r.displayStatus} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-primary">{r.booth.id}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.booth.location}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-[10px] font-bold uppercase tracking-wider",
                        statusMeta[r.displayStatus].text,
                      )}
                    >
                      {statusMeta[r.displayStatus].label}
                    </p>
                  </div>
                  <RiskBadge level={r.risk.level} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
