import type { FilterInfo } from "@/data/types";

const DAY = 86400_000;

export type FilterStatus = "Normal" | "Service Due Soon" | "Service Due" | "Inspection Required";

export type FilterEstimate = {
  status: FilterStatus;
  remainingCapacityL: number;
  remainingCapacityPct: number;
  daysInService: number;
  /** Days until the manufacturer's maximum service interval is reached. */
  daysLeftByInterval: number;
  /** Days of rated capacity left at the current usage; null without reliable usage data. */
  daysLeftByCapacity: number | null;
  /** Whichever limit comes first. */
  estimatedRemainingDays: number;
  governing: "capacity" | "interval";
  dailyUsageL: number | null;
  usageReliable: boolean;
  reasons: string[];
};

export const DUE_SOON_DAYS = 30;
export const DUE_SOON_CAPACITY_PCT = 15;

/**
 * Transparent filter-maintenance estimate.
 *   remaining capacity = max(0, rated capacity - cumulative processed litres)
 *   remaining days     = remaining capacity / average daily usage   (only with reliable usage data)
 * The service interval and the rated capacity are both applied - whichever comes first.
 * This is an ESTIMATE from rated figures. Sensor readings are not proof that a filter is
 * exhausted or working, so `qualityAbnormal` only raises "Inspection Required".
 */
export function estimateFilter(
  f: FilterInfo,
  usage: { value: number | null; reliable: boolean },
  qualityAbnormal = false,
  now = Date.now(),
): FilterEstimate {
  const remainingCapacityL = Math.max(0, f.ratedCapacityL - f.processedL);
  const remainingCapacityPct =
    f.ratedCapacityL > 0 ? (remainingCapacityL / f.ratedCapacityL) * 100 : 0;
  const daysInService = Math.max(0, Math.floor((now - Date.parse(f.installedAt)) / DAY));
  const daysLeftByInterval = Math.max(0, f.maxServiceDays - daysInService);
  const daysLeftByCapacity =
    usage.reliable && usage.value && usage.value > 0
      ? Math.floor(remainingCapacityL / usage.value)
      : null;

  let governing: "capacity" | "interval" = "interval";
  let estimatedRemainingDays = daysLeftByInterval;
  if (daysLeftByCapacity !== null && daysLeftByCapacity < daysLeftByInterval) {
    governing = "capacity";
    estimatedRemainingDays = daysLeftByCapacity;
  }
  if (remainingCapacityL === 0) {
    governing = "capacity";
    estimatedRemainingDays = 0;
  }

  const reasons: string[] = [];
  let status: FilterStatus = "Normal";
  if (remainingCapacityL === 0) reasons.push("Rated capacity has been reached.");
  if (daysLeftByInterval === 0)
    reasons.push(`The ${f.maxServiceDays}-day service interval has elapsed.`);

  if (remainingCapacityL === 0 || daysLeftByInterval === 0) {
    status = "Service Due";
  } else if (qualityAbnormal) {
    status = "Inspection Required";
    reasons.push(
      "Recent TDS/pH readings are outside the monitoring range. This does not prove the filter is exhausted; inspect it.",
    );
  } else if (
    estimatedRemainingDays <= DUE_SOON_DAYS ||
    remainingCapacityPct <= DUE_SOON_CAPACITY_PCT
  ) {
    status = "Service Due Soon";
    if (estimatedRemainingDays <= DUE_SOON_DAYS)
      reasons.push(
        `About ${estimatedRemainingDays} day(s) left by ${governing === "capacity" ? "rated capacity" : "service interval"}.`,
      );
    if (remainingCapacityPct <= DUE_SOON_CAPACITY_PCT)
      reasons.push(`Only ${remainingCapacityPct.toFixed(0)}% of rated capacity remains.`);
  }
  if (!usage.reliable)
    reasons.push(
      "Not enough usage data to project capacity in days; using the service interval only.",
    );

  return {
    status,
    remainingCapacityL,
    remainingCapacityPct,
    daysInService,
    daysLeftByInterval,
    daysLeftByCapacity,
    estimatedRemainingDays,
    governing,
    dailyUsageL: usage.value,
    usageReliable: usage.reliable,
    reasons,
  };
}

export const filterTone: Record<FilterStatus, string> = {
  Normal: "bg-ok-soft text-ok",
  "Service Due Soon": "bg-warn-soft text-warn-foreground",
  "Inspection Required": "bg-warn-soft text-warn-foreground",
  "Service Due": "bg-crit-soft text-crit",
};
