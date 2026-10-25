import type { RiskAssessment, RiskFeatures } from "@/domain/risk";

/**
 * Optional hook for a real machine-learning service.
 *
 * Set VITE_ML_API_URL to a Python (FastAPI/Flask + scikit-learn) endpoint that accepts
 * POST { features: RiskFeatures } and returns { level, score, reasons: [{text, points}] }.
 * When it is unset or unreachable, the app keeps using the transparent rules in
 * src/domain/risk.ts. See ml/README.md for the contract and training notes.
 */
export async function predictRisk(features: RiskFeatures): Promise<RiskAssessment | null> {
  const url = (import.meta.env as Record<string, string | undefined>)["VITE_ML_API_URL"];
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Pick<RiskAssessment, "level" | "score" | "reasons">;
    if (!["Low", "Medium", "High"].includes(data.level)) return null;
    return { ...data, features, model: "remote" };
  } catch {
    return null;
  }
}
