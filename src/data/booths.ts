import type { Booth, BoothCategory, BoothStatus } from "./types";
import { defaultFilter } from "./filterDefaults";

export { statusMeta } from "./types";
export type { Booth, BoothCategory, BoothStatus } from "./types";

// IIT (BHU) campus, Varanasi. The prototype layout grid (0-100%) is mapped onto
// a ~1.1 km box around the institute. Positions are approximate: drag markers on
// the "Manage booths" page to fine-tune them against the real map.
export const CAMPUS_CENTER = { lat: 25.265, lng: 82.99 };
const gridToLatLng = (x: number, y: number) => ({
  lat: Number((25.27 - (y / 100) * 0.01).toFixed(6)),
  lng: Number((82.985 + (x / 100) * 0.01).toFixed(6)),
});

const mk = (
  id: string,
  location: string,
  building: string,
  category: BoothCategory,
  status: BoothStatus,
  x: number,
  y: number,
  extra: { floor?: string } = {},
): Booth => ({
  id,
  location,
  building,
  floor: extra.floor ?? "Ground Floor",
  category,
  status,
  ...gridToLatLng(x, y),
  filter: defaultFilter(id),
});

/** Base demo booths. Telemetry, complaints and tasks are layered on top in seed.ts. */
export const booths: Booth[] = [
  mk(
    "B-17",
    "Department of Biochemical Engineering",
    "School of Biochemical Engineering",
    "Academic",
    "critical",
    34,
    42,
    {
      floor: "Ground Floor",
    },
  ),
  mk(
    "B-01",
    "Department of Ceramic Engineering",
    "Ceramic Engineering Block",
    "Academic",
    "operational",
    22,
    30,
  ),
  mk(
    "B-04",
    "Department of Chemical Engineering",
    "Chemical Engineering Block",
    "Academic",
    "operational",
    28,
    55,
  ),
  mk(
    "B-08",
    "Department of Metallurgical Engineering",
    "Metallurgy Block",
    "Academic",
    "attention",
    18,
    62,
    {},
  ),
  mk(
    "B-12",
    "Department of Pharmaceutical Engineering",
    "Pharma Block",
    "Academic",
    "operational",
    40,
    26,
  ),
  mk(
    "D-01",
    "Department of Civil Engineering",
    "Civil Engineering Block",
    "Academic",
    "operational",
    46,
    60,
  ),
  mk(
    "D-03",
    "Department of Electrical Engineering",
    "Electrical Block",
    "Academic",
    "unavailable",
    52,
    48,
  ),
  mk(
    "D-05",
    "Department of Computer Science & Engineering",
    "CSE Block",
    "Academic",
    "operational",
    58,
    36,
    { floor: "First Floor" },
  ),
  mk(
    "D-08",
    "Department of Mechanical Engineering",
    "Mechanical Block",
    "Academic",
    "operational",
    62,
    58,
  ),
  mk("D-11", "Department of Mining Engineering", "Mining Block", "Academic", "attention", 68, 66),
  mk("D-14", "Department of Physics", "Science Block", "Academic", "operational", 44, 18, {
    floor: "Second Floor",
  }),
  mk(
    "D-16",
    "Department of Mathematical Sciences",
    "Science Block",
    "Academic",
    "operational",
    50,
    14,
  ),
  mk("D-19", "Department of Chemistry", "Science Block", "Academic", "critical", 55, 20, {}),
  mk("H-01", "Rajputana Bhawan", "Hostel Block A", "Hostel", "operational", 12, 20),
  mk("H-02", "Dhanrajgiri Bhawan", "Hostel Block B", "Hostel", "operational", 10, 34),
  mk("H-04", "Morvi Bhawan", "Hostel Block C", "Hostel", "attention", 14, 48, {}),
  mk("H-06", "Vishwakarma Bhawan", "Hostel Block D", "Hostel", "operational", 8, 58),
  mk("H-08", "Aryabhatta Bhawan", "Hostel Block E", "Hostel", "unavailable", 16, 72),
  mk("H-10", "Limbdi Corner Hostel", "Hostel Block F", "Hostel", "operational", 24, 78),
  mk("H-12", "New Girls Hostel", "Hostel Block G", "Hostel", "operational", 32, 84),
  mk("H-15", "SN Bose Bhawan", "Hostel Block H", "Hostel", "critical", 20, 88, {}),
  mk(
    "L-01",
    "Central Library — Reading Hall",
    "Central Library",
    "Library",
    "operational",
    48,
    40,
    { floor: "First Floor" },
  ),
  mk(
    "L-03",
    "Central Library — Entrance Lobby",
    "Central Library",
    "Library",
    "critical",
    46,
    44,
    {},
  ),
  mk("L-05", "Departmental Library, Mining", "Mining Block", "Library", "operational", 70, 72),
  mk(
    "A-01",
    "Main Administrative Building",
    "Administrative Block",
    "Administrative",
    "operational",
    60,
    26,
  ),
  mk("A-03", "Academic Section", "Administrative Block", "Administrative", "attention", 64, 30),
  mk(
    "A-05",
    "Director's Office Wing",
    "Administrative Block",
    "Administrative",
    "operational",
    66,
    22,
  ),
  mk("C-02", "Vishwanath Temple Complex", "Common Area", "Common Area", "operational", 38, 70),
  mk("C-04", "Students' Activity Centre", "Common Area", "Common Area", "operational", 30, 66),
  mk("C-06", "Swatantrata Bhawan", "Common Area", "Common Area", "unavailable", 42, 78),
  mk(
    "C-08",
    "Sports Complex — Ground Pavilion",
    "Common Area",
    "Common Area",
    "operational",
    74,
    46,
  ),
  mk("C-10", "Health Centre", "Common Area", "Common Area", "operational", 78, 34),
];

/** "b-1", "B01", "b_01" -> "B1" so codes match however they were typed or scanned. */
export const boothKey = (id: string) => {
  const m = id.trim().match(/^([a-z]+)[\s_-]*0*(\d+)$/i);
  return m ? `${m[1]!.toUpperCase()}${m[2]}` : id.trim().toUpperCase();
};

export const findBooth = <T extends { id: string }>(list: T[], id: string) => {
  const key = boothKey(id);
  return list.find((b) => boothKey(b.id) === key);
};
