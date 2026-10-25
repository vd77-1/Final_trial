import type { Booth, SensorReading } from "@/data/types";
import type { FilterEstimate } from "./filter";
import {
  baseline,
  changePct,
  consecutiveLowFlow,
  flowBaseline,
  hoursSince,
  latestOf,
  rollingAvg,
} from "./telemetry";
import { PH_MAX, PH_MIN, STALE_HOURS, TDS_ACCEPTABLE } from "./thresholds";

export type RiskLevel = "Low" | "Medium" | "High";

export type RiskReason = { text: string; points: number };

export type RiskFeatures = {
  tdsPpm: number | null;
  ph: number | null;
  temperatureC: number | null;
  flowLpm: number | null;
  tdsRolling6: number | null;
  flowRolling6: number | null;
  tdsChange24hPct: number | null;
  tdsChange7dPct: number | null;
  flowChange24hPct: number | null;
  flowVsBaselinePct: number | null;
  staleHours: number | null;
  openComplaints: number;
  complaints30d: number;
  maintenanceEvents60d: number;
  cumulativeProcessedL: number;
};

export type RiskAssessment = {
  level: RiskLevel;
  /** 0-100 rule score. A demonstration estimate, NOT a validated probability. */
  score: number;
  reasons: RiskReason[];
  features: RiskFeatures;
  model: "rules-v1" | "remote";
};

export type RiskInput = {
  booth: Booth;
  readings: SensorReading[]; // ascending by time
  openComplaints: number;
  complaints30d: number;
  maintenanceEvents60d: number;
  filter: FilterEstimate;
  now?: number;
};

export const RISK_DISCLAIMER =
  "Demonstration estimate from transparent rules on simulated data. It is not a validated prediction and gives no failure date. A trained model can replace it via the optional ML API (see ml/README.md).";

export function extractFeatures(i: RiskInput): RiskFeatures {
  const now = i.now ?? Date.now();
  const rs = i.readings;
  const last = latestOf(rs);
  const base = flowBaseline(rs);
  return {
    tdsPpm: last?.tdsPpm ?? null,
    ph: last?.ph ?? null,
    temperatureC: last?.temperatureC ?? null,
    flowLpm: last?.flowLpm ?? null,
    tdsRolling6: rs.length ? rollingAvg(rs, "tdsPpm", 6) : null,
    flowRolling6: rs.length ? rollingAvg(rs, "flowLpm", 6) : null,
    tdsChange24hPct: changePct(rs, "tdsPpm", 24),
    tdsChange7dPct: changePct(rs, "tdsPpm", 24 * 6),
    flowChange24hPct: changePct(rs, "flowLpm", 24),
    flowVsBaselinePct:
      base && rs.length ? ((rollingAvg(rs, "flowLpm", 6) - base) / base) * 100 : null,
    staleHours: hoursSince(last?.ts, now),
    openComplaints: i.openComplaints,
    complaints30d: i.complaints30d,
    maintenanceEvents60d: i.maintenanceEvents60d,
    cumulativeProcessedL: i.booth.filter.processedL,
  };
}

/** Rules-based anomaly score with a reason for every point added. */
export function assessRisk(i: RiskInput): RiskAssessment {
  const f = extractFeatures(i);
  const rs = i.readings;
  const reasons: RiskReason[] = [];
  const add = (points: number, text: string) => reasons.push({ points, text });

  // Data availability
  if (f.staleHours === null) add(25, "No sensor data has been received from this booth.");
  else if (f.staleHours > 24) add(30, `No sensor reading for ${Math.round(f.staleHours)} hours.`);
  else if (f.staleHours > STALE_HOURS)
    add(20, `No sensor reading for ${Math.round(f.staleHours)} hours.`);

  // Flow vs the booth's own baseline
  const base = flowBaseline(rs);
  if (base && rs.length) {
    const low30 = consecutiveLowFlow(rs, base, 0.7);
    const low15 = consecutiveLowFlow(rs, base, 0.85);
    if (low30 >= 4)
      add(
        30,
        `Flow has remained 30% or more below this booth's baseline (${base.toFixed(1)} L/min) for ${low30} consecutive readings.`,
      );
    else if (low15 >= 6)
      add(
        15,
        `Flow has stayed more than 15% below this booth's baseline (${base.toFixed(1)} L/min) for ${low15} readings.`,
      );
  }

  // Water-quality monitoring indicators
  if (f.tdsPpm !== null && f.tdsPpm > TDS_ACCEPTABLE)
    add(25, `TDS ${f.tdsPpm} ppm exceeds the ${TDS_ACCEPTABLE} ppm acceptable reference.`);
  else if (f.tdsPpm !== null && f.tdsPpm > 0.7 * TDS_ACCEPTABLE)
    add(8, `TDS ${f.tdsPpm} ppm is approaching the ${TDS_ACCEPTABLE} ppm reference.`);
  if (f.tdsChange7dPct !== null && f.tdsChange7dPct >= 25)
    add(15, `TDS has risen ${f.tdsChange7dPct.toFixed(0)}% over the past week.`);
  else if (f.tdsChange24hPct !== null && f.tdsChange24hPct >= 20)
    add(8, `TDS has risen ${f.tdsChange24hPct.toFixed(0)}% in the past 24 hours.`);
  if (f.ph !== null && (f.ph < PH_MIN || f.ph > PH_MAX))
    add(20, `pH ${f.ph} is outside the ${PH_MIN}-${PH_MAX} reference range.`);
  const phBase = baseline(rs, "ph");
  if (f.ph !== null && phBase && Math.abs(f.ph - phBase) >= 0.6 && f.ph >= PH_MIN && f.ph <= PH_MAX)
    add(
      6,
      `pH has drifted ${Math.abs(f.ph - phBase).toFixed(1)} units from this booth's baseline.`,
    );
  if (f.temperatureC !== null && f.temperatureC > 35)
    add(
      5,
      `Outlet water is ${f.temperatureC.toFixed(0)} °C, which suggests cooling is not working.`,
    );

  // History
  if (f.openComplaints >= 2) add(15, `${f.openComplaints} open complaints for this booth.`);
  else if (f.openComplaints === 1) add(8, "1 open complaint for this booth.");
  if (f.complaints30d >= 3)
    add(8, `${f.complaints30d} complaints in the last 30 days (recurring issue).`);
  if (f.maintenanceEvents60d >= 2)
    add(8, `${f.maintenanceEvents60d} maintenance events in the last 60 days.`);

  // Filter
  if (i.filter.status === "Service Due") add(15, "Filter service is due.");
  else if (i.filter.status === "Service Due Soon") add(8, "Filter service is due soon.");

  const score = Math.min(
    100,
    reasons.reduce((a, r) => a + r.points, 0),
  );
  const level: RiskLevel = score >= 45 ? "High" : score >= 20 ? "Medium" : "Low";
  if (!reasons.length)
    reasons.push({ points: 0, text: "No abnormal indicators in the available data." });
  return {
    level,
    score,
    reasons: reasons.sort((a, b) => b.points - a.points),
    features: f,
    model: "rules-v1",
  };
}

export const riskTone: Record<RiskLevel, { chip: string; text: string }> = {
  Low: { chip: "bg-ok-soft text-ok", text: "text-ok" },
  Medium: { chip: "bg-warn-soft text-warn-foreground", text: "text-warn-foreground" },
  High: { chip: "bg-crit-soft text-crit", text: "text-crit" },
};
