import type { SensorReading } from "@/data/types";

/**
 * Monitoring thresholds. These are *monitoring references*, not a potability
 * decision: TDS and pH alone cannot certify that drinking water is safe.
 *
 * - pH 6.5-8.5: reference range from the Indian drinking-water specification (IS 10500).
 * - TDS 500 mg/L (~ppm): acceptable limit. The same specification permits up to
 *   2,000 mg/L only where no alternate source is available.
 */
export const PH_MIN = 6.5;
export const PH_MAX = 8.5;
export const TDS_ACCEPTABLE = 500;
export const TDS_PERMISSIBLE_MAX = 2000;
/** A booth with no reading for this long is treated as offline / no recent data. */
export const STALE_HOURS = 6;

export const QUALITY_DISCLAIMER =
  "TDS and pH are monitoring indicators only. They cannot detect pathogens, arsenic, fluoride, pesticides or other contaminants, so they do not certify that water is safe to drink. Periodic laboratory testing is still required.";

export type QualityLevel = "within" | "attention" | "lab" | "nodata";

export type QualityAssessment = {
  level: QualityLevel;
  label: string;
  notes: string[];
};

export function assessQuality(
  r: Pick<SensorReading, "tdsPpm" | "ph"> | undefined,
): QualityAssessment {
  if (!r)
    return { level: "nodata", label: "No recent data", notes: ["No sensor reading available."] };
  const notes: string[] = [];
  let level: QualityLevel = "within";
  if (r.tdsPpm > TDS_PERMISSIBLE_MAX) {
    level = "lab";
    notes.push(`TDS ${r.tdsPpm} ppm is above the ${TDS_PERMISSIBLE_MAX} ppm upper limit.`);
  } else if (r.tdsPpm > TDS_ACCEPTABLE) {
    level = "attention";
    notes.push(`TDS ${r.tdsPpm} ppm is above the ${TDS_ACCEPTABLE} ppm acceptable reference.`);
  }
  if (r.ph < 5.5 || r.ph > 9.5) {
    level = "lab";
    notes.push(`pH ${r.ph} is far outside the ${PH_MIN}-${PH_MAX} reference range.`);
  } else if (r.ph < PH_MIN || r.ph > PH_MAX) {
    if (level === "within") level = "attention";
    notes.push(`pH ${r.ph} is outside the ${PH_MIN}-${PH_MAX} reference range.`);
  }
  const label =
    level === "within"
      ? "Within monitored range"
      : level === "attention"
        ? "Attention required"
        : "Laboratory verification recommended";
  if (level === "within") notes.push("TDS and pH are inside the monitoring reference ranges.");
  return { level, label, notes };
}

export const tdsTone = (v: number) => (v > TDS_ACCEPTABLE ? "warn" : "ok");
export const phTone = (v: number) => (v < PH_MIN || v > PH_MAX ? "warn" : "ok");
