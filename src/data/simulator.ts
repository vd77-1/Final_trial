import { hash } from "./filterDefaults";
import type { SensorReading } from "./types";

/**
 * Sensor SIMULATOR. TRISHNA has no physical sensors connected yet, so every reading
 * produced here is labelled `source: "simulated"`. Real ESP32 readings would be
 * written to the `sensor_readings` collection with `source: "hardware"`.
 *
 * Output is deterministic per booth (seeded PRNG) but anchored to the current time,
 * with noise, daily usage cycles, occasional missing readings and a few abnormal trends.
 */

export type Scenario =
  | "normal"
  | "flowDrop" // flow gradually falls ~40% over the last 3 days
  | "noFlow" // flow ~0 for the last day
  | "tdsRise" // TDS creeps up past the 500 ppm reference
  | "tdsDrift" // TDS rising but still below reference
  | "phDrift" // pH drifts above 8.5
  | "offline" // stopped reporting ~30 h ago
  | "intermittent"; // frequent missing readings

const SCENARIOS: Record<string, Scenario> = {
  "B-17": "flowDrop",
  "L-03": "noFlow",
  "C-06": "noFlow",
  "D-03": "flowDrop",
  "H-08": "noFlow",
  "D-19": "tdsRise",
  "D-11": "tdsDrift",
  "B-08": "phDrift",
  "H-04": "flowDrop",
  "H-15": "offline",
  "C-10": "offline",
  "A-03": "intermittent",
};

export const scenarioFor = (id: string): Scenario => SCENARIOS[id] ?? "normal";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3600_000;
// Relative use by hour of day (campus water demand peaks late morning / afternoon).
const USE = [
  0.05, 0.03, 0.02, 0.02, 0.03, 0.06, 0.12, 0.25, 0.5, 0.8, 0.9, 1, 1, 0.9, 0.95, 0.85, 0.7, 0.6,
  0.55, 0.5, 0.35, 0.2, 0.12, 0.08,
];

export const SIM_DAYS = 7;

export function generateReadings(boothId: string, now = Date.now()): SensorReading[] {
  const scenario = scenarioFor(boothId);
  const h = hash(boothId);
  const rand = rng(h);
  const n = (amp: number) => (rand() + rand() + rand() - 1.5) * (amp / 1.5); // ~gaussian-ish noise
  const baseTds = 110 + (h % 120);
  const basePh = 7.0 + ((h >> 3) % 6) / 10;
  const baseFlow = 2.0 + ((h >> 5) % 8) / 10;
  const popularity = 140 + ((h >> 7) % 260); // litres per day
  const total = SIM_DAYS * 24;
  const end = Math.floor(now / HOUR) * HOUR;
  const out: SensorReading[] = [];
  const offlineHours = scenario === "offline" ? 30 + (h % 12) : 0;
  let tdsWalk = 0;

  for (let i = total; i >= 0; i--) {
    const ts = end - i * HOUR;
    const hoursAgo = i;
    if (offlineHours && hoursAgo < offlineHours) continue;
    const missP = scenario === "intermittent" ? 0.28 : 0.03;
    if (rand() < missP) continue;

    const date = new Date(ts);
    const hod = date.getHours();
    const prog = 1 - hoursAgo / total; // 0 -> oldest, 1 -> now
    tdsWalk = tdsWalk * 0.9 + n(2.5);

    let tds = baseTds + tdsWalk + n(6);
    let ph = basePh + n(0.12);
    let flow = baseFlow + n(0.18);
    const temp = 19 + 5 * Math.sin(((hod - 8) / 24) * Math.PI * 2) + n(0.8) + (h % 4);

    switch (scenario) {
      case "flowDrop":
        flow *= 1 - 0.42 * Math.max(0, (prog - 0.55) / 0.45);
        break;
      case "noFlow":
        if (hoursAgo < 26) flow = Math.max(0, n(0.05));
        break;
      case "tdsRise":
        tds += 380 * Math.pow(Math.max(0, (prog - 0.35) / 0.65), 1.4);
        break;
      case "tdsDrift":
        tds += 190 * Math.max(0, (prog - 0.3) / 0.7);
        break;
      case "phDrift":
        ph += 1.5 * Math.max(0, (prog - 0.4) / 0.6);
        break;
      default:
        break;
    }

    flow = Math.max(0, flow);
    const use = USE[hod]!;
    const volume =
      flow < 0.15
        ? 0
        : (popularity / 24) * (use / 0.45) * (0.85 + rand() * 0.3) * (flow / baseFlow);
    out.push({
      boothId,
      ts: new Date(ts).toISOString(),
      tdsPpm: Math.round(Math.max(20, tds)),
      ph: Number(Math.max(4, ph).toFixed(2)),
      temperatureC: Number(temp.toFixed(1)),
      flowLpm: Number(flow.toFixed(2)),
      volumeL: Math.round(volume),
      source: "simulated",
      deviceStatus: flow < 0.15 ? "fault" : scenario === "intermittent" ? "degraded" : "ok",
    });
  }
  return out;
}

const cache = new Map<string, { at: number; data: SensorReading[] }>();
/** Cached per booth for 5 minutes so lists and detail pages agree. */
export function simulatedReadings(boothId: string): SensorReading[] {
  const hit = cache.get(boothId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data;
  const data = generateReadings(boothId);
  cache.set(boothId, { at: Date.now(), data });
  return data;
}
