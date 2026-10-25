/**
 * Shared domain types for TRISHNA.
 *
 * Firestore collections (see src/services/firebaseBackend.ts):
 *   water_booths, sensor_readings, complaints, maintenance_tasks,
 *   maintenance_history, users, device_status
 * All timestamps are ISO-8601 strings (UTC) so the demo store and Firestore
 * share one document shape.
 */

export type BoothStatus = "operational" | "unavailable" | "attention" | "critical" | "offline";
export type BoothCategory = "Academic" | "Hostel" | "Library" | "Administrative" | "Common Area";

/** Filter / purifier fitted to a booth. Values are admin-entered, not sensed. */
export type FilterInfo = {
  type: string;
  /** Manufacturer-rated capacity in litres. */
  ratedCapacityL: number;
  /** Cumulative litres processed since installation (from a flow meter or admin entry). */
  processedL: number;
  /** Installation / last replacement date (ISO). */
  installedAt: string;
  /** Manufacturer-recommended maximum service interval in days. */
  maxServiceDays: number;
};

export type Booth = {
  /** Stable unique ID, e.g. "B-17". Also the document ID. */
  id: string;
  location: string;
  building: string;
  floor: string;
  category: BoothCategory;
  /** Operational status as set by admin / workflow. "offline" is derived from stale data. */
  status: BoothStatus;
  lat: number;
  lng: number;
  assignedMts?: string | undefined; // user id
  lastVerifiedAt?: string | undefined;
  lastMaintenanceAt?: string | undefined;
  filter: FilterInfo;
  /** true if added by a person in the prototype (not part of the demo seed). */
  custom?: boolean | undefined;
};

export type ReadingSource = "simulated" | "hardware";

export type SensorReading = {
  boothId: string;
  /** ISO timestamp. */
  ts: string;
  tdsPpm: number;
  ph: number;
  temperatureC: number;
  flowLpm: number;
  /** Litres dispensed since the previous reading (used for usage estimates). */
  volumeL?: number | undefined;
  source: ReadingSource;
  deviceStatus?: "ok" | "degraded" | "fault" | undefined;
};

export const COMPLAINT_CATEGORIES = [
  "No Water",
  "Poor Flow",
  "Suspected Water-Quality Issue",
  "Damaged Equipment",
  "Leakage",
  "Other",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export type ComplaintStatus =
  "Submitted" | "Verified" | "Rejected" | "Assigned" | "Accepted" | "In Progress" | "Resolved";

export type TimelineEvent = {
  at: string;
  status: ComplaintStatus;
  note?: string | undefined;
  by?: string | undefined;
};

export type Complaint = {
  /** Public reference number, also the document ID (e.g. "TR-7K3Q9X"). */
  id: string;
  boothId: string;
  category: ComplaintCategory;
  description: string;
  photoUrl?: string | undefined;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  verifiedBy?: string | undefined;
  rejectReason?: string | undefined;
  taskId?: string | undefined;
  timeline: TimelineEvent[];
};

export type TaskPriority = "Urgent" | "High" | "Normal";
export type TaskStatus = "Assigned" | "Accepted" | "In Progress" | "Resolved";

export type TaskNote = { at: string; by: string; text: string };

export type MaintenanceTask = {
  id: string;
  complaintId?: string | undefined;
  boothId: string;
  title: string;
  /** User id of the MTS. */
  assignedTo: string;
  assignedBy: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  acceptedAt?: string | undefined;
  startedAt?: string | undefined;
  resolvedAt?: string | undefined;
  notes: TaskNote[];
};

export type HistoryType = "complaint-resolved" | "filter-replaced" | "inspection" | "repair";

export type MaintenanceHistoryEntry = {
  id: string;
  boothId: string;
  at: string;
  type: HistoryType;
  summary: string;
  by: string;
  taskId?: string | undefined;
  complaintId?: string | undefined;
};

export type UserRole = "admin" | "mts";
export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  zone?: string | undefined;
};

/** Collections the app syncs. Keys are logical names; Firestore names are mapped in the backend. */
export type CollectionMap = {
  booths: Booth;
  complaints: Complaint;
  tasks: MaintenanceTask;
  history: MaintenanceHistoryEntry;
  users: AppUser;
};
export type CollectionName = keyof CollectionMap;

export const statusMeta: Record<
  BoothStatus,
  {
    label: string;
    short: string;
    dot: string;
    chip: string;
    text: string;
    ring: string;
    color: string;
  }
> = {
  operational: {
    label: "NORMAL",
    short: "Normal",
    dot: "bg-ok",
    chip: "bg-ok-soft text-ok",
    text: "text-ok",
    ring: "ring-ok/30",
    color: "#16a34a",
  },
  attention: {
    label: "ATTENTION NEEDED",
    short: "Attention needed",
    dot: "bg-warn",
    chip: "bg-warn-soft text-warn-foreground",
    text: "text-warn-foreground",
    ring: "ring-warn/30",
    color: "#f59e0b",
  },
  unavailable: {
    label: "WATER UNAVAILABLE",
    short: "Water unavailable",
    dot: "bg-warn",
    chip: "bg-warn-soft text-warn-foreground",
    text: "text-warn-foreground",
    ring: "ring-warn/30",
    color: "#f59e0b",
  },
  critical: {
    label: "NOT WORKING",
    short: "Not working",
    dot: "bg-crit",
    chip: "bg-crit-soft text-crit",
    text: "text-crit",
    ring: "ring-crit/30",
    color: "#dc2626",
  },
  offline: {
    label: "OFFLINE / NO RECENT DATA",
    short: "Offline",
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    ring: "ring-border",
    color: "#6b7280",
  },
};
