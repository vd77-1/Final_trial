import { boothKey } from "@/data/booths";
import { defaultFilter } from "@/data/filterDefaults";
import type {
  Booth,
  BoothCategory,
  BoothStatus,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  FilterInfo,
  MaintenanceHistoryEntry,
  MaintenanceTask,
  TaskPriority,
} from "@/data/types";
import { getBackend } from "./backend";
import { ensureStarted, stores } from "./store";

/**
 * Workflow actions. Every state change goes through here so the whole chain stays consistent:
 *   Student reports -> Admin verifies -> Admin assigns -> MTS accepts -> MTS resolves -> booth/task status updates.
 * Authorization is enforced by Firestore rules in Firebase mode and by the route guards in the UI.
 */

const now = () => new Date().toISOString();
const be = () => {
  ensureStarted(); // pages like /track call actions before any store hook has run
  return getBackend();
};
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomCode(len: number): string {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const OPEN_COMPLAINT: ComplaintStatus[] = [
  "Verified",
  "Assigned",
  "Accepted",
  "In Progress",
];
export const isOpenComplaint = (c: Complaint) =>
  c.status === "Submitted" || OPEN_COMPLAINT.includes(c.status);

const SEVERITY: Record<BoothStatus, number> = {
  operational: 0,
  offline: 0,
  attention: 1,
  unavailable: 2,
  critical: 3,
};
const statusForCategory = (c: ComplaintCategory): BoothStatus =>
  c === "No Water" ? "unavailable" : c === "Damaged Equipment" ? "critical" : "attention";

const booth = (id: string) => stores.booths.data.find((b) => b.id === id);
const complaint = (id: string) => stores.complaints.data.find((c) => c.id === id);

// ---------------------------------------------------------------- public: complaints

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type ComplaintInput = {
  boothId: string;
  category: ComplaintCategory;
  description: string;
  photo?: File | null;
};

export function validateComplaint(i: ComplaintInput): string | null {
  if (
    !i.boothId.trim() ||
    (!booth(i.boothId.trim().toUpperCase()) &&
      !stores.booths.data.some((b) => boothKey(b.id) === boothKey(i.boothId)))
  )
    return "Choose a valid booth ID.";
  if (i.description.trim().length < 10)
    return "Please describe the problem in at least 10 characters.";
  if (i.description.length > 1000) return "Description is too long (max 1000 characters).";
  if (i.photo) {
    if (!i.photo.type.startsWith("image/")) return "The photo must be an image file.";
    if (i.photo.size > MAX_PHOTO_BYTES) return "The photo must be 5 MB or smaller.";
  }
  return null;
}

export async function submitComplaint(
  i: ComplaintInput,
): Promise<{ id: string; photoFailed: boolean }> {
  const err = validateComplaint(i);
  if (err) throw new Error(err);
  const b = stores.booths.data.find((x) => boothKey(x.id) === boothKey(i.boothId))!;
  const id = `TR-${randomCode(6)}`;
  let photoUrl: string | undefined;
  let photoFailed = false;
  if (i.photo) {
    try {
      photoUrl = await be().uploadPhoto(id, i.photo);
    } catch {
      photoFailed = true;
    }
  }
  const t = now();
  const c: Complaint = {
    id,
    boothId: b.id,
    category: i.category,
    description: i.description.trim(),
    ...(photoUrl ? { photoUrl } : {}),
    status: "Submitted",
    createdAt: t,
    updatedAt: t,
    timeline: [{ at: t, status: "Submitted" }],
  };
  await be().put("complaints", c);
  return { id, photoFailed };
}

export const lookupComplaint = (ref: string) => be().getComplaint(ref);

// ---------------------------------------------------------------- admin: complaints

async function patchComplaint(
  c: Complaint,
  status: ComplaintStatus,
  by: string,
  note?: string,
  extra: Partial<Complaint> = {},
) {
  const t = now();
  const next: Complaint = {
    ...c,
    ...extra,
    status,
    updatedAt: t,
    timeline: [...c.timeline, { at: t, status, by, ...(note ? { note } : {}) }],
  };
  await be().put("complaints", next);
  return next;
}

/** Recompute a booth's workflow status from its open, verified complaints. */
async function syncBoothStatus(boothId: string, extra: Partial<Booth> = {}) {
  const b = booth(boothId);
  if (!b) return;
  const open = stores.complaints.data.filter(
    (c) => c.boothId === boothId && OPEN_COMPLAINT.includes(c.status),
  );
  let status: BoothStatus = "operational";
  for (const c of open) {
    const s = statusForCategory(c.category);
    if (SEVERITY[s] > SEVERITY[status]) status = s;
  }
  await be().put("booths", { ...b, ...extra, status });
}

export async function verifyComplaint(c: Complaint, by: string, note?: string) {
  if (c.status !== "Submitted") throw new Error("Only new reports can be verified.");
  const next = await patchComplaint(c, "Verified", by, note, { verifiedBy: by });
  const b = booth(c.boothId);
  if (b) {
    const s = statusForCategory(c.category);
    await be().put("booths", {
      ...b,
      status: SEVERITY[s] > SEVERITY[b.status] ? s : b.status,
      lastVerifiedAt: now(),
    });
  }
  return next;
}

export async function rejectComplaint(c: Complaint, by: string, reason: string) {
  if (c.status !== "Submitted") throw new Error("Only new reports can be rejected.");
  if (reason.trim().length < 3) throw new Error("Give a reason for rejecting this report.");
  return patchComplaint(c, "Rejected", by, reason.trim(), {
    rejectReason: reason.trim(),
    verifiedBy: by,
  });
}

export async function assignComplaint(
  c: Complaint,
  mtsId: string,
  priority: TaskPriority,
  by: string,
) {
  if (c.status !== "Verified") throw new Error("Verify the report before assigning it.");
  if (!stores.users.data.some((u) => u.id === mtsId && u.role === "mts"))
    throw new Error("Choose a maintenance staff member.");
  const t = now();
  const task: MaintenanceTask = {
    id: `T-${randomCode(5)}`,
    complaintId: c.id,
    boothId: c.boothId,
    title: `${c.category}: ${c.description.slice(0, 70)}`,
    assignedTo: mtsId,
    assignedBy: by,
    priority,
    status: "Assigned",
    createdAt: t,
    notes: [],
  };
  await be().put("tasks", task);
  await patchComplaint(c, "Assigned", by, undefined, { taskId: task.id });
  return task;
}

// ---------------------------------------------------------------- MTS: tasks

async function patchTask(task: MaintenanceTask, patch: Partial<MaintenanceTask>) {
  const next = { ...task, ...patch };
  await be().put("tasks", next);
  return next;
}

export async function acceptTask(task: MaintenanceTask, by: string) {
  if (task.status !== "Assigned") throw new Error("This task has already been accepted.");
  const next = await patchTask(task, { status: "Accepted", acceptedAt: now() });
  const c = task.complaintId ? complaint(task.complaintId) : undefined;
  if (c) await patchComplaint(c, "Accepted", by);
  return next;
}

export async function startTask(task: MaintenanceTask, by: string) {
  if (task.status !== "Accepted") throw new Error("Accept the task before starting work.");
  const next = await patchTask(task, { status: "In Progress", startedAt: now() });
  const c = task.complaintId ? complaint(task.complaintId) : undefined;
  if (c) await patchComplaint(c, "In Progress", by);
  return next;
}

export async function addTaskNote(task: MaintenanceTask, by: string, text: string) {
  if (!text.trim()) throw new Error("Write a note first.");
  return patchTask(task, { notes: [...task.notes, { at: now(), by, text: text.trim() }] });
}

export async function resolveTask(task: MaintenanceTask, by: string, note: string) {
  if (task.status !== "In Progress")
    throw new Error("Start work before marking the task resolved.");
  if (note.trim().length < 3) throw new Error("Add a short resolution note.");
  const t = now();
  const next = await patchTask(task, {
    status: "Resolved",
    resolvedAt: t,
    notes: [...task.notes, { at: t, by, text: note.trim() }],
  });
  const c = task.complaintId ? complaint(task.complaintId) : undefined;
  if (c) await patchComplaint(c, "Resolved", by, note.trim());
  const entry: MaintenanceHistoryEntry = {
    id: `h-${task.id}`,
    boothId: task.boothId,
    at: t,
    type: "complaint-resolved",
    summary: `${c?.category ?? "Task"} resolved: ${note.trim()}`,
    by,
    taskId: task.id,
    ...(task.complaintId ? { complaintId: task.complaintId } : {}),
  };
  await be().put("history", entry);
  // The resolved complaint no longer counts as open, so recompute the booth's status.
  await syncBoothStatus(task.boothId, { lastMaintenanceAt: t, lastVerifiedAt: t });
  return next;
}

// ---------------------------------------------------------------- admin: booths

export type BoothForm = {
  id: string;
  location: string;
  building: string;
  floor: string;
  category: BoothCategory;
  status: BoothStatus;
  lat: number;
  lng: number;
  assignedMts?: string | undefined;
  filter?: FilterInfo | undefined;
};

export function validateBooth(f: BoothForm, existingId?: string): string | null {
  const id = f.id.trim().toUpperCase();
  if (!/^[A-Z]+-?\d+$/.test(id)) return "Code must be letters then numbers, e.g. P-01 or LAB-7.";
  if (stores.booths.data.some((b) => boothKey(b.id) === boothKey(id) && b.id !== existingId))
    return `A booth with code ${id} already exists.`;
  if (!f.location.trim()) return "Enter a location name.";
  if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng))
    return "Click the map to choose where the booth is.";
  if (f.filter) {
    if (!(f.filter.ratedCapacityL > 0)) return "Filter rated capacity must be greater than 0.";
    if (!(f.filter.maxServiceDays > 0))
      return "Filter service interval must be greater than 0 days.";
    if (f.filter.processedL < 0) return "Litres processed cannot be negative.";
  }
  return null;
}

export async function addBooth(f: BoothForm): Promise<Booth> {
  const err = validateBooth(f);
  if (err) throw new Error(err);
  const id = f.id.trim().toUpperCase();
  const b: Booth = {
    id,
    location: f.location.trim(),
    building: f.building.trim() || f.location.trim(),
    floor: f.floor.trim() || "Ground Floor",
    category: f.category,
    status: f.status,
    lat: Number(f.lat.toFixed(6)),
    lng: Number(f.lng.toFixed(6)),
    assignedMts: f.assignedMts,
    lastVerifiedAt: now(),
    filter: f.filter ?? { ...defaultFilter(id), processedL: 0, installedAt: now() },
    custom: true,
  };
  await be().put("booths", b);
  return b;
}

export async function updateBooth(id: string, patch: Partial<Booth>) {
  const b = booth(id);
  if (!b) throw new Error("Booth not found.");
  await be().put("booths", { ...b, ...patch });
}

export async function editBooth(id: string, f: BoothForm) {
  const err = validateBooth(f, id);
  if (err) throw new Error(err);
  await updateBooth(id, {
    location: f.location.trim(),
    building: f.building.trim(),
    floor: f.floor.trim(),
    category: f.category,
    status: f.status,
    assignedMts: f.assignedMts,
    ...(f.filter ? { filter: f.filter } : {}),
  });
}

export const setBoothStatus = (id: string, status: BoothStatus) =>
  updateBooth(id, { status, lastVerifiedAt: now() });
export const moveBooth = (id: string, lat: number, lng: number) =>
  updateBooth(id, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
export const removeBooth = (id: string) => be().remove("booths", id);

/** Record a filter replacement: resets counters and stores a service-history entry. */
export async function recordFilterReplacement(
  id: string,
  by: string,
  opts: { type?: string; ratedCapacityL?: number; maxServiceDays?: number } = {},
) {
  const b = booth(id);
  if (!b) throw new Error("Booth not found.");
  const t = now();
  const filter: FilterInfo = {
    ...b.filter,
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.ratedCapacityL ? { ratedCapacityL: opts.ratedCapacityL } : {}),
    ...(opts.maxServiceDays ? { maxServiceDays: opts.maxServiceDays } : {}),
    processedL: 0,
    installedAt: t,
  };
  await be().put("booths", { ...b, filter, lastMaintenanceAt: t });
  await be().put("history", {
    id: `h-filter-${id}-${Date.now()}`,
    boothId: id,
    at: t,
    type: "filter-replaced",
    summary: `Filter replaced (${filter.type}). Counters reset.`,
    by,
  });
}

export async function logInspection(id: string, by: string, summary: string) {
  if (summary.trim().length < 3) throw new Error("Describe what was inspected.");
  await be().put("history", {
    id: `h-insp-${id}-${Date.now()}`,
    boothId: id,
    at: now(),
    type: "inspection",
    summary: summary.trim(),
    by,
  });
}

export const resetDemoData = () => be().resetDemo?.();
