import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  PlayCircle,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/trishna/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MaintenanceTask, TaskPriority, TaskStatus } from "@/data/types";
import { fmtDateTime, nameOf } from "@/lib/boothUtils";
import { cn } from "@/lib/utils";
import { acceptTask, addTaskNote, resolveTask, startTask } from "@/services/actions";
import { useAuth } from "@/services/auth";
import { useBooths, useComplaints, useHistory, useTasks, useUsers } from "@/services/store";

export const Route = createFileRoute("/mts")({
  head: () => ({
    meta: [{ title: "Maintenance Dashboard — TRISHNA" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminShell requires="mts">
      <MtsDashboard />
    </AdminShell>
  ),
});

const priorityTone: Record<TaskPriority, string> = {
  Urgent: "bg-crit-soft text-crit",
  High: "bg-warn-soft text-warn-foreground",
  Normal: "bg-accent text-accent-foreground",
};
const statusTone: Record<TaskStatus, string> = {
  Assigned: "bg-info-soft text-primary",
  Accepted: "bg-accent text-accent-foreground",
  "In Progress": "bg-warn-soft text-warn-foreground",
  Resolved: "bg-ok-soft text-ok",
};
const prioRank = { Urgent: 0, High: 1, Normal: 2 } as const;

function MtsDashboard() {
  const { user } = useAuth();
  const allTasks = useTasks();
  const [view, setView] = useState<"active" | "done">("active");
  // Firestore rules only return the signed-in MTS's own tasks; the filter keeps the demo store consistent.
  const tasks = useMemo(
    () => allTasks.filter((t) => t.assignedTo === user?.id),
    [allTasks, user?.id],
  );
  const active = tasks
    .filter((t) => t.status !== "Resolved")
    .sort(
      (a, b) =>
        prioRank[a.priority] - prioRank[b.priority] ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
  const done = tasks
    .filter((t) => t.status === "Resolved")
    .sort((a, b) => Date.parse(b.resolvedAt ?? "") - Date.parse(a.resolvedAt ?? ""));

  const stats = [
    {
      label: "Awaiting acceptance",
      value: tasks.filter((t) => t.status === "Assigned").length,
      icon: Wrench,
      tone: "text-primary bg-accent",
    },
    {
      label: "Urgent open",
      value: active.filter((t) => t.priority === "Urgent").length,
      icon: TriangleAlert,
      tone: "text-crit bg-crit-soft",
    },
    {
      label: "In progress",
      value: tasks.filter((t) => t.status === "In Progress" || t.status === "Accepted").length,
      icon: Clock,
      tone: "text-warn-foreground bg-warn-soft",
    },
    { label: "Resolved", value: done.length, icon: CheckCircle2, tone: "text-ok bg-ok-soft" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <h1 className="font-display text-2xl font-bold text-primary">My maintenance tasks</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user?.name}
        {user?.zone ? ` · Zone: ${user.zone}` : ""}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-elevated flex items-center gap-3 px-4 py-3">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", s.tone)}>
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="font-display text-2xl font-bold leading-tight text-primary">
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2" role="tablist">
        {(
          [
            ["active", `Open (${active.length})`],
            ["done", `History (${done.length})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            type="button"
            onClick={() => setView(k)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold",
              view === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {(view === "active" ? active : done).length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {view === "active"
              ? "No open tasks. New assignments will appear here."
              : "No resolved tasks yet."}
          </p>
        )}
        {(view === "active" ? active : done).map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task: t }: { task: MaintenanceTask }) {
  const { user } = useAuth();
  const booths = useBooths();
  const complaints = useComplaints();
  const users = useUsers();
  const history = useHistory()
    .filter((h) => h.boothId === t.boothId)
    .slice(0, 3);
  const booth = booths.find((b) => b.id === t.boothId);
  const complaint = complaints.find((c) => c.id === t.complaintId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!user) return null;

  return (
    <article className="card-elevated p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/booth/$id"
              params={{ id: t.boothId }}
              className="font-display text-base font-bold text-primary hover:underline"
            >
              Booth {t.boothId}
            </Link>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                priorityTone[t.priority],
              )}
            >
              {t.priority}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                statusTone[t.status],
              )}
            >
              {t.status}
            </span>
            <span className="text-xs text-muted-foreground">{t.id}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />{" "}
            {booth ? `${booth.location} · ${booth.floor}` : t.boothId} · Assigned{" "}
            {fmtDateTime(t.createdAt)}
          </p>
          <p className="mt-2 text-sm font-semibold">{complaint?.category ?? t.title}</p>
          {complaint && <p className="text-sm text-muted-foreground">{complaint.description}</p>}
        </div>
        {complaint?.photoUrl && (
          <a
            href={complaint.photoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open complaint photo"
          >
            <img
              src={complaint.photoUrl}
              alt={`Reported problem at booth ${t.boothId}`}
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          </a>
        )}
      </div>

      {t.notes.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-surface p-3 text-xs">
          {t.notes.map((n) => (
            <li key={n.at + n.text}>
              <span className="text-muted-foreground">
                {fmtDateTime(n.at)} · {nameOf(users, n.by)}:
              </span>{" "}
              {n.text}
            </li>
          ))}
        </ul>
      )}
      {t.status === "Resolved" && (
        <p className="mt-3 text-xs text-ok">Resolved {fmtDateTime(t.resolvedAt)}</p>
      )}
      {history.length > 0 && t.status !== "Resolved" && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold">
            Recent maintenance on this booth
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {history.map((h) => (
              <li key={h.id}>
                {fmtDateTime(h.at)}: {h.summary}
              </li>
            ))}
          </ul>
        </details>
      )}

      {t.status !== "Resolved" && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-2">
            {t.status === "Assigned" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => acceptTask(t, user.id), `${t.id} accepted`)}
              >
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Accept task
              </Button>
            )}
            {t.status === "Accepted" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => startTask(t, user.id), `Work started on ${t.id}`)}
              >
                <PlayCircle className="mr-1.5 h-4 w-4" /> Start work
              </Button>
            )}
            {t.status === "In Progress" && !resolving && (
              <Button size="sm" onClick={() => setResolving(true)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark resolved
              </Button>
            )}
          </div>
          {t.status !== "Assigned" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await addTaskNote(t, user.id, note);
                  setNote("");
                }, "Note added");
              }}
            >
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a work note"
                aria-label={`Work note for ${t.id}`}
                className="h-9"
              />
              <Button type="submit" size="sm" variant="outline" disabled={busy}>
                Add note
              </Button>
            </form>
          )}
          {resolving && (
            <div className="space-y-2 rounded-xl bg-surface p-3">
              <label htmlFor={`res-${t.id}`} className="text-xs font-semibold">
                What was done?
              </label>
              <Textarea
                id={`res-${t.id}`}
                rows={2}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await resolveTask(t, user.id, resolution);
                      setResolving(false);
                    }, `${t.id} resolved. Booth status updated.`)
                  }
                >
                  Confirm resolved
                </Button>
                <Button size="sm" variant="outline" onClick={() => setResolving(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
