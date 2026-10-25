import type { SensorReading } from "@/data/types";
import { STALE_HOURS } from "./thresholds";

const HOUR = 3600_000;
const t = (r: SensorReading) => Date.parse(r.ts);

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const latestOf = (rs: SensorReading[]): SensorReading | undefined => rs[rs.length - 1];

export function hoursSince(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  return (now - Date.parse(iso)) / HOUR;
}

export function isStale(latest: SensorReading | undefined, now = Date.now()): boolean {
  const h = hoursSince(latest?.ts, now);
  return h === null || h > STALE_HOURS;
}

type Field = "tdsPpm" | "ph" | "temperatureC" | "flowLpm";

/** Mean of the last `n` readings. */
export const rollingAvg = (rs: SensorReading[], f: Field, n: number) =>
  mean(rs.slice(-n).map((r) => r[f]));

/**
 * Percentage change of a field: mean of the last 6 h versus the 6 h window that
 * ended `hoursAgo` hours before the latest reading. null if either window is empty.
 */
export function changePct(rs: SensorReading[], f: Field, hoursAgo: number): number | null {
  const last = latestOf(rs);
  if (!last) return null;
  const end = t(last);
  const recent = rs.filter((r) => t(r) > end - 6 * HOUR).map((r) => r[f]);
  const past = rs
    .filter((r) => t(r) <= end - hoursAgo * HOUR && t(r) > end - (hoursAgo + 6) * HOUR)
    .map((r) => r[f]);
  if (!recent.length || !past.length) return null;
  const p = mean(past);
  if (!p) return null;
  return ((mean(recent) - p) / p) * 100;
}

/**
 * Per-booth flow baseline: median of non-zero flow readings from the older part of
 * the history (everything before the last 48 h), so a recent decline does not
 * drag its own baseline down. Falls back to all readings if history is short.
 */
export function flowBaseline(rs: SensorReading[]): number | null {
  if (rs.length < 24) return null;
  const last = latestOf(rs)!;
  const cutoff = t(last) - 48 * HOUR;
  let pool = rs.filter((r) => t(r) < cutoff && r.flowLpm > 0.3).map((r) => r.flowLpm);
  if (pool.length < 12) pool = rs.filter((r) => r.flowLpm > 0.3).map((r) => r.flowLpm);
  return pool.length >= 12 ? median(pool) : null;
}

export function baseline(rs: SensorReading[], f: "tdsPpm" | "ph"): number | null {
  if (rs.length < 24) return null;
  const cutoff = t(latestOf(rs)!) - 48 * HOUR;
  const pool = rs.filter((r) => t(r) < cutoff).map((r) => r[f]);
  return pool.length >= 12 ? median(pool) : null;
}

/** Average daily dispensed volume from the last 7 days; only "reliable" with enough coverage. */
export function dailyUsage(rs: SensorReading[]): { value: number | null; reliable: boolean } {
  if (!rs.length) return { value: null, reliable: false };
  const end = t(latestOf(rs)!);
  const win = rs.filter((r) => t(r) > end - 7 * 24 * HOUR && r.volumeL !== undefined);
  if (win.length < 100) return { value: null, reliable: false }; // < ~60% of 168 hourly readings
  const days = (t(win[win.length - 1]!) - t(win[0]!)) / (24 * HOUR);
  if (days < 5) return { value: null, reliable: false };
  const total = win.reduce((a, r) => a + (r.volumeL ?? 0), 0);
  return { value: Math.round(total / days), reliable: true };
}

/** Number of the most recent readings that sit below `ratio` x baseline flow (consecutive from the latest). */
export function consecutiveLowFlow(rs: SensorReading[], base: number, ratio: number): number {
  let n = 0;
  for (let i = rs.length - 1; i >= 0 && n < 48; i--) {
    if (rs[i]!.flowLpm < base * ratio) n++;
    else break;
  }
  return n;
}

export type ChartPoint = { t: number; label: string; value: number | null };

/** Bucket readings for charts: hourly for 24 h, 6-hourly for 7 d. Gaps show as null. */
export function series(rs: SensorReading[], f: Field, range: "24h" | "7d"): ChartPoint[] {
  const bucket = range === "24h" ? HOUR : 6 * HOUR;
  const span = range === "24h" ? 24 * HOUR : 7 * 24 * HOUR;
  const end = Math.ceil(Date.now() / bucket) * bucket;
  const start = end - span;
  const out: ChartPoint[] = [];
  for (let ts = start; ts < end; ts += bucket) {
    const vals = rs.filter((r) => t(r) >= ts && t(r) < ts + bucket).map((r) => r[f]);
    const d = new Date(ts);
    out.push({
      t: ts,
      label:
        range === "24h"
          ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
          : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      value: vals.length ? Number(mean(vals).toFixed(f === "ph" ? 2 : 1)) : null,
    });
  }
  return out;
}
