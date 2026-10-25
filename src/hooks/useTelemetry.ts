import { useEffect, useMemo, useState } from "react";
import type {
  Booth,
  BoothStatus,
  Complaint,
  MaintenanceHistoryEntry,
  SensorReading,
} from "@/data/types";
import { estimateFilter, type FilterEstimate } from "@/domain/filter";
import { assessRisk, type RiskAssessment } from "@/domain/risk";
import { dailyUsage, isStale, latestOf } from "@/domain/telemetry";
import { assessQuality, type QualityAssessment } from "@/domain/thresholds";
import { predictRisk } from "@/services/mlApi";
import { getBackend } from "@/services/backend";
import { isOpenComplaint } from "@/services/actions";
import { useBooths, useComplaints, useHistory } from "@/services/store";

const DAY = 86400_000;
const REFRESH_MS = 60_000;

export type LiveBooth = Booth & {
  latest?: SensorReading | undefined;
  /** Status shown to people: workflow status, or "offline" when sensor data is stale. */
  displayStatus: BoothStatus;
  stale: boolean;
};

const idsKey = (ids: string[]) => ids.join("|");

/** Light query: the latest reading per booth (used by public pages). */
export function useLiveBooths() {
  const booths = useBooths();
  const key = idsKey(booths.map((b) => b.id));
  const [latest, setLatest] = useState<Record<string, SensorReading | undefined> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const load = () =>
      getBackend()
        .getLatest(key.split("|"))
        .then((r) => !cancelled && (setLatest(r), setError(null)))
        .catch(
          () => !cancelled && setError("Couldn't load sensor data. Showing last known status."),
        );
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [key]);

  const live: LiveBooth[] = useMemo(
    () =>
      booths.map((b) => {
        const l = latest?.[b.id];
        const stale = latest ? isStale(l) : false;
        const displayStatus: BoothStatus =
          stale && (b.status === "operational" || b.status === "attention") ? "offline" : b.status;
        return { ...b, latest: l, stale, displayStatus };
      }),
    [booths, latest],
  );
  return { booths: live, telemetryLoaded: latest !== null, telemetryError: error };
}

export type BoothAnalytics = {
  booth: Booth;
  readings: SensorReading[];
  latest?: SensorReading | undefined;
  stale: boolean;
  displayStatus: BoothStatus;
  quality: QualityAssessment;
  usage: { value: number | null; reliable: boolean };
  filter: FilterEstimate;
  risk: RiskAssessment;
  openComplaints: number;
};

export function computeAnalytics(
  booth: Booth,
  readings: SensorReading[],
  complaints: Complaint[],
  history: MaintenanceHistoryEntry[],
  now = Date.now(),
): BoothAnalytics {
  const latest = latestOf(readings);
  const stale = isStale(latest, now);
  const mine = complaints.filter((c) => c.boothId === booth.id);
  const usage = dailyUsage(readings);
  // "Sustained" abnormal quality: at least 3 of the last 6 readings outside monitoring ranges.
  const recent = readings.slice(-6);
  const abnormal = recent.filter((r) => assessQuality(r).level !== "within").length >= 3;
  const filter = estimateFilter(booth.filter, usage, abnormal, now);
  const risk = assessRisk({
    booth,
    readings,
    openComplaints: mine.filter(isOpenComplaint).length,
    complaints30d: mine.filter((c) => now - Date.parse(c.createdAt) < 30 * DAY).length,
    maintenanceEvents60d: history.filter(
      (h) => h.boothId === booth.id && now - Date.parse(h.at) < 60 * DAY,
    ).length,
    filter,
    now,
  });
  return {
    booth,
    readings,
    latest,
    stale,
    displayStatus:
      stale && (booth.status === "operational" || booth.status === "attention")
        ? "offline"
        : booth.status,
    quality: assessQuality(stale ? undefined : latest),
    usage,
    filter,
    risk,
    openComplaints: mine.filter(isOpenComplaint).length,
  };
}

/** Full 7-day analytics for every booth (admin pages). */
export function useFleetAnalytics() {
  const booths = useBooths();
  const complaints = useComplaints();
  const history = useHistory();
  const key = idsKey(booths.map((b) => b.id));
  const [readings, setReadings] = useState<Record<string, SensorReading[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const load = () =>
      getBackend()
        .getReadings(key.split("|"), Date.now() - 7 * DAY)
        .then((r) => !cancelled && (setReadings(r), setError(null)))
        .catch(() => !cancelled && setError("Couldn't load sensor history."));
    load();
    const t = setInterval(load, REFRESH_MS * 5);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [key]);

  const rows = useMemo(
    () =>
      readings
        ? booths.map((b) => computeAnalytics(b, readings[b.id] ?? [], complaints, history))
        : [],
    [booths, readings, complaints, history],
  );
  const byId = useMemo(() => new Map(rows.map((r) => [r.booth.id, r])), [rows]);
  return { rows, byId, loading: readings === null && !error, error };
}

/** Analytics for one booth, with an optional remote ML score (see services/mlApi.ts). */
export function useBoothAnalytics(booth: Booth | undefined) {
  const complaints = useComplaints();
  const history = useHistory();
  const [readings, setReadings] = useState<SensorReading[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = booth?.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = () =>
      getBackend()
        .getReadings([id], Date.now() - 7 * DAY)
        .then((r) => !cancelled && (setReadings(r[id] ?? []), setError(null)))
        .catch(() => !cancelled && setError("Couldn't load sensor history."));
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  const base = useMemo(
    () => (booth && readings ? computeAnalytics(booth, readings, complaints, history) : null),
    [booth, readings, complaints, history],
  );

  const [remote, setRemote] = useState<RiskAssessment | null>(null);
  useEffect(() => {
    setRemote(null);
    if (!base) return;
    let cancelled = false;
    predictRisk(base.risk.features).then((r) => !cancelled && r && setRemote(r));
    return () => {
      cancelled = true;
    };
  }, [base?.risk.score, base?.booth.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const analytics = base && remote ? { ...base, risk: remote } : base;
  return { analytics, loading: readings === null && !error, error };
}
