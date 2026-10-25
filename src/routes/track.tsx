import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, Search, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/trishna/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Complaint, ComplaintStatus } from "@/data/types";
import { fmtDateTime } from "@/lib/boothUtils";
import { lookupComplaint } from "@/services/actions";

export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } =>
    typeof s["ref"] === "string" ? { ref: s["ref"] } : {},
  head: () => ({
    meta: [
      { title: "Track a Report — TRISHNA" },
      { name: "description", content: "Check the progress of a water-booth issue you reported." },
    ],
  }),
  component: TrackPage,
});

const STEPS: { status: ComplaintStatus; label: string }[] = [
  { status: "Submitted", label: "Submitted" },
  { status: "Verified", label: "Verified by admin" },
  { status: "Assigned", label: "Assigned to maintenance" },
  { status: "Accepted", label: "Accepted by maintenance" },
  { status: "In Progress", label: "Work in progress" },
  { status: "Resolved", label: "Resolved" },
];

function TrackPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const [value, setValue] = useState(ref ?? "");
  const [complaint, setComplaint] = useState<Complaint | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    lookupComplaint(ref)
      .then((c) => !cancelled && setComplaint(c))
      .catch(
        () => !cancelled && setError("Couldn't look that up. Check your connection and try again."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const reached = new Set(complaint?.timeline.map((t) => t.status));
  const at = (s: ComplaintStatus) => complaint?.timeline.find((t) => t.status === s)?.at;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl font-bold text-primary">Track a report</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the reference number you received, e.g. TR-7K3Q9X.
        </p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = value.trim().toUpperCase();
            if (!v) return setError("Enter a reference number.");
            setError("");
            navigate({ to: "/track", search: { ref: v } });
          }}
        >
          <div className="flex-1">
            <Label htmlFor="ref" className="sr-only">
              Reference number
            </Label>
            <Input
              id="ref"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="TR-XXXXXX"
              className="h-11 uppercase"
            />
          </div>
          <Button type="submit" size="lg">
            <Search className="mr-2 h-4 w-4" /> Track
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-crit-soft px-3 py-2 text-sm text-crit">
            {error}
          </p>
        )}
        {loading && (
          <p className="mt-6 flex items-center text-sm text-muted-foreground" role="status">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up…
          </p>
        )}
        {!loading && ref && complaint === null && (
          <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No report found for <strong>{ref}</strong>. Check the reference and try again.
          </p>
        )}
        {!loading && complaint && (
          <section className="card-elevated mt-6 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Report {complaint.id}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-primary">
              {complaint.category}
            </h2>
            <p className="text-sm text-muted-foreground">
              Booth {complaint.boothId} · submitted {fmtDateTime(complaint.createdAt)}
            </p>
            <p className="mt-3 text-sm">{complaint.description}</p>
            {complaint.status === "Rejected" ? (
              <div className="mt-5 flex gap-3 rounded-xl bg-crit-soft p-4 text-sm text-crit">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Report closed</p>
                  <p>{complaint.rejectReason}</p>
                </div>
              </div>
            ) : (
              <ol className="mt-5 space-y-3">
                {STEPS.map((s) => {
                  const ok = reached.has(s.status);
                  return (
                    <li key={s.status} className="flex items-start gap-3">
                      {ok ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-ok" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 text-muted-foreground/50" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${ok ? "" : "text-muted-foreground"}`}>
                          {s.label}
                        </p>
                        {ok && (
                          <p className="text-xs text-muted-foreground">
                            {fmtDateTime(at(s.status))}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
