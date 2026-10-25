import { booths as baseBooths } from "./booths";
import type {
  AppUser,
  Booth,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  MaintenanceHistoryEntry,
  MaintenanceTask,
  TaskStatus,
} from "./types";

const H = 3600_000;
const iso = (hoursAgo: number, now: number) => new Date(now - hoursAgo * H).toISOString();

export const seedUsers = (): AppUser[] => [
  { id: "u-admin", name: "Dr. A. Sharma", email: "admin@trishna.demo", role: "admin" },
  {
    id: "u-mts-1",
    name: "R. Prasad",
    email: "prasad@trishna.demo",
    role: "mts",
    zone: "Academic & Library",
  },
  { id: "u-mts-2", name: "S. Yadav", email: "yadav@trishna.demo", role: "mts", zone: "Hostels" },
  {
    id: "u-mts-3",
    name: "M. Singh",
    email: "singh@trishna.demo",
    role: "mts",
    zone: "Administrative & Common",
  },
];

/** Demo credentials (demo mode only; never used with Firebase). */
export const DEMO_PASSWORD = "demo1234";

export const seedBooths = (now = Date.now()): Booth[] => {
  const mtsFor = (b: Booth) =>
    b.category === "Hostel"
      ? "u-mts-2"
      : b.category === "Academic" || b.category === "Library"
        ? "u-mts-1"
        : "u-mts-3";
  return baseBooths.map((b) => ({
    ...b,
    assignedMts: mtsFor(b),
    lastVerifiedAt: iso(6 + (b.id.length % 5), now),
    lastMaintenanceAt: iso(24 * (12 + (b.id.charCodeAt(2) % 40)), now),
  }));
};

type C = [
  id: string,
  booth: string,
  cat: ComplaintCategory,
  hoursAgo: number,
  status: ComplaintStatus,
  desc: string,
];
const complaintRows: C[] = [
  [
    "TR-4M7K2Q",
    "B-17",
    "Poor Flow",
    5,
    "Submitted",
    "Water trickles out and the chilled water is warm.",
  ],
  [
    "TR-8H3N5W",
    "B-17",
    "Damaged Equipment",
    20,
    "Assigned",
    "Cooler panel is cracked and humming loudly.",
  ],
  ["TR-2P9X6D", "L-03", "No Water", 26, "In Progress", "No water since morning. Tap is dry."],
  ["TR-6C4V8J", "H-04", "Leakage", 30, "Verified", "Leak near the drain outlet, floor is wet."],
  [
    "TR-9T5B3R",
    "D-19",
    "Suspected Water-Quality Issue",
    34,
    "Assigned",
    "Water tastes salty and slightly bitter.",
  ],
  ["TR-3F7G4Y", "H-15", "No Water", 52, "Accepted", "Unit is dead, display is off."],
  [
    "TR-7K2M9S",
    "D-11",
    "Suspected Water-Quality Issue",
    70,
    "Submitted",
    "Unusual smell from the water.",
  ],
  ["TR-5W8Z3L", "A-03", "Other", 96, "Resolved", "Filter replacement reminder light is on."],
  ["TR-1D6Q8N", "C-06", "Damaged Equipment", 120, "Resolved", "Tap handle is broken."],
  ["TR-4R9H2B", "B-08", "Poor Flow", 150, "Rejected", "Water seems slow today."],
  ["TR-8Y3J7P", "D-03", "Poor Flow", 8, "Verified", "Flow has been weak all week."],
  ["TR-2S5V9K", "H-08", "No Water", 14, "Submitted", "Nothing comes out of the tap."],
];

const mtsFor: Record<string, string> = {
  "B-17": "u-mts-1",
  "L-03": "u-mts-1",
  "D-19": "u-mts-1",
  "H-15": "u-mts-2",
  "A-03": "u-mts-3",
  "C-06": "u-mts-3",
};
const prioFor = (c: ComplaintCategory) =>
  c === "No Water" ? "Urgent" : c === "Damaged Equipment" || c === "Leakage" ? "High" : "Normal";

export function seedComplaintsAndTasks(now = Date.now()) {
  const complaints: Complaint[] = [];
  const tasks: MaintenanceTask[] = [];
  const history: MaintenanceHistoryEntry[] = [];
  let tn = 1040;

  for (const [id, boothId, category, hoursAgo, status, description] of complaintRows) {
    const created = iso(hoursAgo, now);
    const timeline: Complaint["timeline"] = [{ at: created, status: "Submitted" }];
    const step = (st: ComplaintStatus, offset: number, note?: string, by = "u-admin") =>
      timeline.push({
        at: iso(Math.max(0, hoursAgo - offset), now),
        status: st,
        by,
        ...(note ? { note } : {}),
      });

    const c: Complaint = {
      id,
      boothId,
      category,
      description,
      status,
      createdAt: created,
      updatedAt: created,
      timeline,
    };
    if (status === "Rejected") {
      step("Rejected", 2, "Readings were normal and no fault found.");
      c.rejectReason = "Readings were normal and no fault found.";
      c.verifiedBy = "u-admin";
    } else if (status !== "Submitted") {
      step("Verified", 1);
      c.verifiedBy = "u-admin";
    }
    if (["Assigned", "Accepted", "In Progress", "Resolved"].includes(status)) {
      const mts = mtsFor[boothId] ?? "u-mts-1";
      const taskId = `T-${++tn}`;
      step("Assigned", 2);
      const t: MaintenanceTask = {
        id: taskId,
        complaintId: id,
        boothId,
        title: `${category}: ${description.slice(0, 60)}`,
        assignedTo: mts,
        assignedBy: "u-admin",
        priority: prioFor(category),
        status: (status === "Resolved" ? "Resolved" : status) as TaskStatus,
        createdAt: iso(Math.max(0, hoursAgo - 2), now),
        notes: [],
      };
      if (["Accepted", "In Progress", "Resolved"].includes(status)) {
        step("Accepted", 4, undefined, mts);
        t.acceptedAt = iso(Math.max(0, hoursAgo - 4), now);
      }
      if (["In Progress", "Resolved"].includes(status)) {
        step("In Progress", 6, undefined, mts);
        t.startedAt = iso(Math.max(0, hoursAgo - 6), now);
        t.notes.push({ at: t.startedAt, by: mts, text: "On site, inspecting the unit." });
      }
      if (status === "Resolved") {
        step("Resolved", 10, "Fixed and tested.", mts);
        t.resolvedAt = iso(Math.max(0, hoursAgo - 10), now);
        t.notes.push({ at: t.resolvedAt, by: mts, text: "Fixed and tested." });
        history.push({
          id: `h-${id}`,
          boothId,
          at: t.resolvedAt,
          type: "complaint-resolved",
          summary: `${category} resolved: fixed and tested.`,
          by: mts,
          taskId,
          complaintId: id,
        });
      }
      c.taskId = taskId;
      tasks.push(t);
    }
    c.updatedAt = timeline[timeline.length - 1]!.at;
    complaints.push(c);
  }

  // Older maintenance history
  const older: [string, number, MaintenanceHistoryEntry["type"], string][] = [
    ["B-17", 24 * 40, "repair", "Compressor serviced; coolant topped up."],
    ["B-17", 24 * 18, "inspection", "Routine inspection; no faults found."],
    ["H-04", 24 * 25, "repair", "Replaced leaking inlet valve."],
    ["D-19", 24 * 50, "filter-replaced", "Filter cartridge replaced."],
    ["L-03", 24 * 33, "repair", "Pump replaced."],
    ["L-03", 24 * 12, "repair", "Re-seated pump connector."],
  ];
  older.forEach(([boothId, h, type, summary], i) =>
    history.push({ id: `h-old-${i}`, boothId, at: iso(h, now), type, summary, by: "u-mts-1" }),
  );

  return { complaints, tasks, history };
}
