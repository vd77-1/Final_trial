import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SensorReading } from "@/data/types";
import { series } from "@/domain/telemetry";

type Field = "tdsPpm" | "ph" | "temperatureC" | "flowLpm";

export function SensorChart({
  title,
  readings,
  field,
  unit,
  color,
  refs = [],
  baseline,
  compact = false,
}: {
  title: string;
  readings: SensorReading[];
  field: Field;
  unit: string;
  color: string;
  refs?: { y: number; label: string }[];
  baseline?: number | null | undefined;
  compact?: boolean;
}) {
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const data = useMemo(() => series(readings, field, range), [readings, field, range]);
  const hasData = data.some((d) => d.value !== null);
  const yRefs = [
    ...refs,
    ...(baseline ? [{ y: Number(baseline.toFixed(2)), label: "baseline" }] : []),
  ];

  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {range === "24h" ? "Last 24 hours, hourly" : "Last 7 days, 6-hour average"} ({unit})
          </p>
        </div>
        <div
          className="flex rounded-lg bg-surface p-0.5"
          role="group"
          aria-label={`${title} range`}
        >
          {(["24h", "7d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                range === r ? "bg-card text-primary shadow-card" : "text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className={compact ? "mt-3 h-36" : "mt-4 h-48"}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(v) => [`${v} ${unit}`, title]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 12,
                }}
              />
              {yRefs.map((r) => (
                <ReferenceLine
                  key={r.label + r.y}
                  y={r.y}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: r.label,
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                    position: "insideTopRight",
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            No readings in this period.
          </p>
        )}
      </div>
    </div>
  );
}
