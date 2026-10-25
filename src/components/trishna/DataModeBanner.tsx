import { FlaskConical } from "lucide-react";
import { isDemoMode } from "@/services/backend";
import { cn } from "@/lib/utils";

/** Always-visible reminder that sensor values are simulated. No physical sensors are connected yet. */
export function DataModeBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-aqua/30 bg-accent/60 px-4 py-2.5 text-xs text-accent-foreground",
        className,
      )}
      role="note"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-aqua" />
      <p>
        <strong>Simulated data.</strong> TDS, pH, temperature and flow values come from a sensor
        simulator, not physical hardware.
        {isDemoMode()
          ? " The app is in demo mode: booths, reports and tasks are stored in this browser only."
          : " Complaints, tasks and booths are live in the connected Firebase project."}
      </p>
    </div>
  );
}

export function SourceBadge({ source }: { source?: "simulated" | "hardware" | undefined }) {
  if (!source) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        source === "simulated" ? "bg-warn-soft text-warn-foreground" : "bg-ok-soft text-ok",
      )}
    >
      {source === "simulated" ? "Simulated" : "Hardware"}
    </span>
  );
}
