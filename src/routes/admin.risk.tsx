import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { AdminShell } from "@/components/trishna/AdminShell";
import { RiskBadge } from "@/components/trishna/Panels";
import { RISK_DISCLAIMER } from "@/domain/risk";
import { useFleetAnalytics } from "@/hooks/useTelemetry";

export const Route = createFileRoute("/admin/risk")({
  head: () => ({
    meta: [
      { title: "Maintenance risk — TRISHNA Control Centre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <RiskPage />
    </AdminShell>
  ),
});

function RiskPage() {
  const { rows, loading, error } = useFleetAnalytics();
  const sorted = [...rows].sort((a, b) => b.risk.score - a.risk.score);
  const n = (l: string) => rows.filter((r) => r.risk.level === l).length;
  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <h1 className="font-display text-2xl font-bold text-primary">Predictive-maintenance risk</h1>
      <p className="mt-2 flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-xs text-warn-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {RISK_DISCLAIMER}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(["High", "Medium", "Low"] as const).map((l) => (
          <div key={l} className="card-elevated px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {l} risk
            </p>
            <p className="font-display text-3xl font-bold text-primary">{loading ? "–" : n(l)}</p>
          </div>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-foreground"
        >
          {error}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground" role="status">
            Analysing sensor history…
          </p>
        )}
        {sorted.map((r) => (
          <details key={r.booth.id} className="card-elevated p-5" open={r.risk.level === "High"}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span>
                <Link
                  to="/admin/booth/$id"
                  params={{ id: r.booth.id }}
                  className="font-display font-bold text-primary hover:underline"
                >
                  {r.booth.id}
                </Link>
                <span className="ml-2 text-sm text-muted-foreground">{r.booth.location}</span>
              </span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                score {r.risk.score}/100 <RiskBadge level={r.risk.level} />
              </span>
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm">
              {r.risk.reasons.map((x) => (
                <li key={x.text} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aqua" />
                  {x.text}
                  {x.points > 0 && (
                    <span className="text-xs text-muted-foreground">(+{x.points})</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
