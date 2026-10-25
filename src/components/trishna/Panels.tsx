import { BrainCircuit, Filter as FilterIcon, Info } from "lucide-react";
import type { ReactNode } from "react";
import type { FilterEstimate } from "@/domain/filter";
import { filterTone } from "@/domain/filter";
import type { RiskAssessment } from "@/domain/risk";
import { RISK_DISCLAIMER, riskTone } from "@/domain/risk";
import { QUALITY_DISCLAIMER, type QualityAssessment } from "@/domain/thresholds";
import type { FilterInfo } from "@/data/types";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/boothUtils";

export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "ok" | "warn" | "crit" | undefined;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-1 font-display text-xl font-bold text-primary">{value}</p>
      {sub && (
        <p
          className={cn(
            "mt-0.5 text-xs",
            tone === "ok" && "text-ok",
            tone === "warn" && "text-warn-foreground",
            tone === "crit" && "text-crit",
            !tone && "text-muted-foreground",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

const qualityTone = {
  within: "bg-ok-soft text-ok",
  attention: "bg-warn-soft text-warn-foreground",
  lab: "bg-crit-soft text-crit",
  nodata: "bg-muted text-muted-foreground",
} as const;

/** Quality wording never says "safe": TDS and pH alone cannot certify potability. */
export function QualityBadge({ q, className }: { q: QualityAssessment; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        qualityTone[q.level],
        className,
      )}
    >
      {q.label}
    </span>
  );
}

export function QualityNote({ q }: { q: QualityAssessment }) {
  return (
    <div className="space-y-2">
      <QualityBadge q={q} />
      <ul className="list-disc pl-5 text-xs text-muted-foreground">
        {q.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {QUALITY_DISCLAIMER}
      </p>
    </div>
  );
}

export function RiskPanel({ risk }: { risk: RiskAssessment }) {
  return (
    <section className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-accent/50 px-5 py-3">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <BrainCircuit className="h-4 w-4" /> Maintenance risk
        </p>
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warn-foreground">
          Demo estimate
        </span>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-baseline gap-3">
          <p className={cn("font-display text-2xl font-bold", riskTone[risk.level].text)}>
            {risk.level} risk
          </p>
          <p className="text-xs text-muted-foreground">rule score {risk.score}/100</p>
        </div>
        <ul className="space-y-1.5 text-sm">
          {risk.reasons.map((r) => (
            <li key={r.text} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aqua" />
              <span>
                {r.text}
                {r.points > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">(+{r.points})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          {risk.model === "remote" ? "Score from the configured ML API. " : ""}
          {RISK_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}

export function FilterPanel({
  filter,
  est,
  actions,
}: {
  filter: FilterInfo;
  est: FilterEstimate;
  actions?: ReactNode;
}) {
  const used =
    filter.ratedCapacityL > 0
      ? Math.min(100, (filter.processedL / filter.ratedCapacityL) * 100)
      : 0;
  return (
    <section className="card-elevated p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FilterIcon className="h-4 w-4 text-aqua" /> Filter life (estimate)
        </h2>
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", filterTone[est.status])}
        >
          {est.status}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            used > 90 ? "bg-crit" : used > 75 ? "bg-warn" : "bg-aqua",
          )}
          style={{ width: `${used}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {filter.processedL.toLocaleString("en-IN")} of{" "}
        {filter.ratedCapacityL.toLocaleString("en-IN")} L rated capacity used
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {[
          ["Filter type", filter.type],
          ["Installed / replaced", fmtDate(filter.installedAt)],
          ["Days in service", `${est.daysInService} of ${filter.maxServiceDays}`],
          [
            "Remaining capacity",
            `${est.remainingCapacityL.toLocaleString("en-IN")} L (${est.remainingCapacityPct.toFixed(0)}%)`,
          ],
          [
            "Average daily usage",
            est.dailyUsageL !== null ? `${est.dailyUsageL} L/day` : "Not enough data",
          ],
          [
            "Estimated days left",
            `${est.estimatedRemainingDays} (by ${est.governing === "capacity" ? "rated capacity" : "service interval"})`,
          ],
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
      {est.reasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {est.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Estimate from manufacturer-rated capacity and service interval, whichever comes first.
        Sensor readings do not prove a filter is exhausted or working.
      </p>
      {actions && <div className="mt-3">{actions}</div>}
    </section>
  );
}

export function RiskBadge({ level }: { level: RiskAssessment["level"] }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", riskTone[level].chip)}>
      {level}
    </span>
  );
}

export function FilterBadge({ status }: { status: FilterEstimate["status"] }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", filterTone[status])}>
      {status}
    </span>
  );
}
