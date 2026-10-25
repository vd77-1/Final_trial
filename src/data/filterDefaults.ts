import type { FilterInfo } from "./types";

/** Small deterministic hash so demo values are stable per booth ID. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Demo filter fitted to a booth: installed 20-160 days ago. Replace with real records. */
export function defaultFilter(id: string, now = Date.now()): FilterInfo {
  const h = hash(id);
  const days = 20 + (h % 140);
  const daily = 150 + (h % 250);
  return {
    type: "RO + UV purifier (demo)",
    ratedCapacityL: 36000,
    processedL: Math.round(daily * days),
    installedAt: new Date(now - days * 86400000).toISOString(),
    maxServiceDays: 180,
  };
}
