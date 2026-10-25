import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/trishna/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Complaint, ComplaintStatus, TaskPriority } from "@/data/types";
import { fmtDateTime, nameOf, selectClass, timeAgo } from "@/lib/boothUtils";
import { cn } from "@/lib/utils";
import { assignComplaint, rejectComplaint, verifyComplaint } from "@/services/actions";
import { useAuth } from "@/services/auth";
import { useComplaints, useUsers } from "@/services/store";

export const Route = createFileRoute("/admin/complaints")({
  head: () => ({
    meta: [
      { title: "Complaints — TRISHNA Control Centre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <ComplaintsPage />
    </AdminShell>
  ),
});

const tone: Record<ComplaintStatus, string> = {
  Submitted: "bg-info-soft text-primary",
  Verified: "bg-accent text-accent-foreground",
  Rejected: "bg-muted text-muted-foreground",
  Assigned: "bg-warn-soft text-warn-foreground",
  Accepted: "bg-warn-soft text-warn-foreground",
  "In Progress": "bg-warn-soft text-warn-foreground",
  Resolved: "bg-ok-soft text-ok",
};

const FILTERS = [
  "All",
  "Submitted",
  "Verified",
  "Assigned",
  "In Progress",
  "Resolved",
  "Rejected",
] as const;

function ComplaintsPage() {
  const { user } = useAuth();
  const complaints = useComplaints();
  const users = useUsers();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [rejecting, setRejecting] = useState<Complaint | null>(null);
  const [assigning, setAssigning] = useState<Complaint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(
    () =>
      [...complaints]
        .filter(
          (c) =>
            filter === "All" ||
            c.status === filter ||
            (filter === "In Progress" && c.status === "Accepted"),
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [complaints, filter],
  );
  const count = (f: (typeof FILTERS)[number]) =>
    f === "All" ? complaints.length : complaints.filter((c) => c.status === f).length;

  async function run(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <h1 className="font-display text-2xl font-bold text-primary">Complaints</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Student reports → verify → assign to maintenance → accepted → resolved.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {f === "Submitted" ? "New" : f} ({count(f)})
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No complaints in this view.
          </p>
        )}
        {list.map((c) => (
          <article key={c.id} className="card-elevated p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-primary">{c.id}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      tone[c.status],
                    )}
                  >
                    {c.status}
                  </span>
                  <Link
                    to="/admin/booth/$id"
                    params={{ id: c.boothId }}
                    className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Booth {c.boothId}
                  </Link>
                </div>
                <p className="mt-1 text-sm font-semibold">{c.category}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reported {fmtDateTime(c.createdAt)} ({timeAgo(c.createdAt)})
                </p>
                {c.status === "Rejected" && (
                  <p className="mt-1 text-xs text-crit">Rejected: {c.rejectReason}</p>
                )}
                {c.taskId && <p className="mt-1 text-xs text-muted-foreground">Task {c.taskId}</p>}
              </div>
              {c.photoUrl && (
                <a
                  href={c.photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open photo for ${c.id}`}
                >
                  <img
                    src={c.photoUrl}
                    alt={`Reported problem at booth ${c.boothId}`}
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                </a>
              )}
            </div>
            {c.status === "Submitted" && user && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  disabled={busy === c.id}
                  onClick={() =>
                    run(
                      c.id,
                      () => verifyComplaint(c, user.id),
                      `${c.id} verified. Booth status updated.`,
                    )
                  }
                >
                  {busy === c.id ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-4 w-4" />
                  )}{" "}
                  Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(c)}>
                  <X className="mr-1.5 h-4 w-4" /> Reject
                </Button>
              </div>
            )}
            {c.status === "Verified" && (
              <div className="mt-4 border-t border-border pt-4">
                <Button size="sm" onClick={() => setAssigning(c)}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Assign to maintenance
                </Button>
              </div>
            )}
            {c.status !== "Submitted" && c.timeline.length > 1 && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-semibold">History</summary>
                <ul className="mt-2 space-y-1">
                  {c.timeline.map((t) => (
                    <li key={t.at + t.status}>
                      {fmtDateTime(t.at)} · {t.status}
                      {t.by ? ` · ${nameOf(users, t.by)}` : ""}
                      {t.note ? ` · "${t.note}"` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>

      <RejectDialog
        complaint={rejecting}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) =>
          run(
            rejecting!.id,
            () => rejectComplaint(rejecting!, user!.id, reason),
            `${rejecting!.id} rejected.`,
          )
        }
      />
      <AssignDialog
        complaint={assigning}
        onClose={() => setAssigning(null)}
        onSubmit={(mts, p) =>
          run(
            assigning!.id,
            () => assignComplaint(assigning!, mts, p, user!.id),
            `${assigning!.id} assigned to ${nameOf(users, mts)}.`,
          )
        }
      />
    </div>
  );
}

function RejectDialog({
  complaint,
  onClose,
  onSubmit,
}: {
  complaint: Complaint | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  return (
    <Dialog
      open={!!complaint}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setReason("");
          setErr("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {complaint?.id}</DialogTitle>
          <DialogDescription>
            The reporter will see this reason when they track the report.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        {err && (
          <p role="alert" className="text-sm text-crit">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (reason.trim().length < 3)
                return setErr("Give a reason for rejecting this report.");
              await onSubmit(reason);
              onClose();
              setReason("");
              setErr("");
            }}
          >
            Reject report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  complaint,
  onClose,
  onSubmit,
}: {
  complaint: Complaint | null;
  onClose: () => void;
  onSubmit: (mts: string, p: TaskPriority) => Promise<void>;
}) {
  const users = useUsers().filter((u) => u.role === "mts");
  const [mts, setMts] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Normal");
  const [err, setErr] = useState("");
  return (
    <Dialog
      open={!!complaint}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setErr("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {complaint?.id}</DialogTitle>
          <DialogDescription>
            Creates a maintenance task for booth {complaint?.boothId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="mts">Maintenance staff</Label>
            <select
              id="mts"
              className={`${selectClass} mt-1`}
              value={mts}
              onChange={(e) => setMts(e.target.value)}
            >
              <option value="">Choose…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.zone ? ` · ${u.zone}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="prio">Priority</Label>
            <select
              id="prio"
              className={`${selectClass} mt-1`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {(["Urgent", "High", "Normal"] as const).map((p) => (
                <option key={p}>{p}</option>
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
              if (!mts) return setErr("Choose a maintenance staff member.");
              await onSubmit(mts, priority);
              onClose();
              setMts("");
              setErr("");
            }}
          >
            Assign task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
