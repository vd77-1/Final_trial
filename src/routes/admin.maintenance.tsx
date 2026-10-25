import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/trishna/AdminShell";
import { FilterBadge } from "@/components/trishna/Panels";
import { ReplaceFilterDialog } from "@/components/trishna/ReplaceFilterDialog";
import { Button } from "@/components/ui/button";
import type { Booth, TaskStatus } from "@/data/types";
import { useFleetAnalytics } from "@/hooks/useTelemetry";
import { fmtDate, fmtDateTime, nameOf, selectClass } from "@/lib/boothUtils";
import { cn } from "@/lib/utils";
import { useHistory, useTasks, useUsers } from "@/services/store";

export const Route = createFileRoute("/admin/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance — TRISHNA Control Centre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <MaintenancePage />
    </AdminShell>
  ),
});

const taskTone: Record<TaskStatus, string> = {
  Assigned: "bg-info-soft text-primary",
  Accepted: "bg-accent text-accent-foreground",
  "In Progress": "bg-warn-soft text-warn-foreground",
  Resolved: "bg-ok-soft text-ok",
};
const prioTone = {
  Urgent: "bg-crit-soft text-crit",
  High: "bg-warn-soft text-warn-foreground",
  Normal: "bg-accent text-accent-foreground",
} as const;

function MaintenancePage() {
  const [tab, setTab] = useState<"tasks" | "filters" | "history">("tasks");
  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      <h1 className="font-display text-2xl font-bold text-primary">Maintenance</h1>
      <div className="mt-4 flex gap-2" role="tablist">
        {(
          [
            ["tasks", "Tasks"],
            ["filters", "Filter service"],
            ["history", "History"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold",
              tab === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "tasks" ? <Tasks /> : tab === "filters" ? <Filters /> : <History />}
      </div>
    </div>
  );
}

function Tasks() {
  const tasks = useTasks();
  const users = useUsers();
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const list = useMemo(
    () =>
      [...tasks]
        .filter((t) => status === "all" || t.status === status)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [tasks, status],
  );
  return (
    <>
      <select
        className={`${selectClass} max-w-xs`}
        value={status}
        onChange={(e) => setStatus(e.target.value as TaskStatus | "all")}
        aria-label="Filter tasks by status"
      >
        <option value="all">All tasks ({tasks.length})</option>
        {(["Assigned", "Accepted", "In Progress", "Resolved"] as const).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="card-elevated mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Task", "Booth", "Assigned to", "Priority", "Status", "Created", "Resolved"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No tasks.
                </td>
              </tr>
            )}
            {list.map((t) => (
              <tr key={t.id}>
                <td className="max-w-[280px] px-4 py-3">
                  <p className="font-semibold">{t.id}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.title}</p>
                </td>
                <td className="px-4 py-3">
                  <Link
                    to="/admin/booth/$id"
                    params={{ id: t.boothId }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t.boothId}
                  </Link>
                </td>
                <td className="px-4 py-3">{nameOf(users, t.assignedTo)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      prioTone[t.priority],
                    )}
                  >
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      taskTone[t.status],
                    )}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {fmtDateTime(t.createdAt)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {fmtDateTime(t.resolvedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Filters() {
  const { rows, loading } = useFleetAnalytics();
  const [replacing, setReplacing] = useState<Booth | null>(null);
  const order = {
    "Service Due": 0,
    "Inspection Required": 1,
    "Service Due Soon": 2,
    Normal: 3,
  } as const;
  const sorted = [...rows].sort(
    (a, b) =>
      order[a.filter.status] - order[b.filter.status] ||
      a.filter.estimatedRemainingDays - b.filter.estimatedRemainingDays,
  );
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Estimates from manufacturer-rated capacity and service interval, whichever comes first.
        Recording a replacement resets the counters.
      </p>
      <div className="card-elevated mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {[
                "Booth",
                "Filter status",
                "Remaining capacity",
                "Days in service",
                "Est. days left",
                "Daily usage",
                "",
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground" role="status">
                  Loading…
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.booth.id}>
                <td className="px-4 py-3">
                  <Link
                    to="/admin/booth/$id"
                    params={{ id: r.booth.id }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {r.booth.id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <FilterBadge status={r.filter.status} />
                </td>
                <td className="px-4 py-3">
                  {r.filter.remainingCapacityL.toLocaleString("en-IN")} L (
                  {r.filter.remainingCapacityPct.toFixed(0)}%)
                </td>
                <td className="px-4 py-3">
                  {r.filter.daysInService} / {r.booth.filter.maxServiceDays}
                </td>
                <td className="px-4 py-3">{r.filter.estimatedRemainingDays}</td>
                <td className="px-4 py-3">
                  {r.filter.dailyUsageL !== null ? `${r.filter.dailyUsageL} L` : "n/a"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setReplacing(r.booth)}>
                    Record replacement
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReplaceFilterDialog booth={replacing} onClose={() => setReplacing(null)} />
    </>
  );
}

function History() {
  const history = useHistory();
  const users = useUsers();
  const [booth, setBooth] = useState("");
  const list = [...history]
    .filter((h) => !booth || h.boothId === booth)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const ids = [...new Set(history.map((h) => h.boothId))].sort();
  return (
    <>
      <select
        className={`${selectClass} max-w-xs`}
        value={booth}
        onChange={(e) => setBooth(e.target.value)}
        aria-label="Filter history by booth"
      >
        <option value="">All booths</option>
        {ids.map((i) => (
          <option key={i}>{i}</option>
        ))}
      </select>
      <ul className="card-elevated mt-3 divide-y divide-border">
        {list.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">No maintenance history.</li>
        )}
        {list.map((h) => (
          <li
            key={h.id}
            className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm"
          >
            <div>
              <p>
                <Link
                  to="/admin/booth/$id"
                  params={{ id: h.boothId }}
                  className="font-semibold text-primary hover:underline"
                >
                  {h.boothId}
                </Link>{" "}
                · <span className="capitalize">{h.type.replace("-", " ")}</span>
              </p>
              <p className="text-muted-foreground">{h.summary}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmtDate(h.at)} · {nameOf(users, h.by)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
