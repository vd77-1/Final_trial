import { AlertTriangle, CheckCircle2, Droplets, WifiOff, XCircle } from "lucide-react";
import { statusMeta, type BoothStatus } from "@/data/types";
import { cn } from "@/lib/utils";

const icons = {
  operational: CheckCircle2,
  attention: AlertTriangle,
  unavailable: Droplets,
  critical: XCircle,
  offline: WifiOff,
};

export function StatusPill({
  status,
  size = "md",
  className,
}: {
  status: BoothStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = statusMeta[status];
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-semibold uppercase tracking-wide",
        meta.chip,
        size === "lg"
          ? "px-4 py-2 text-sm"
          : size === "sm"
            ? "px-2.5 py-1 text-[11px]"
            : "px-3 py-1.5 text-xs",
        className,
      )}
    >
      <Icon className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} aria-hidden />
      {meta.label}
    </span>
  );
}

export function StatusDot({ status, pulse = true }: { status: BoothStatus; pulse?: boolean }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        meta.dot,
        status === "critical" && pulse && "animate-pulse-crit",
      )}
      aria-hidden
    />
  );
}
