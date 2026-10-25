# TRISHNA — Smart Water. Smarter Campus.

Tracking & Reporting Infrastructure for Safe Hydration Network Access: a management layer over the
existing drinking-water booths of IIT (BHU), Varanasi. It adds QR access, monitored readings,
complaint reporting, booth discovery, a maintenance workflow, filter-life estimates and a
predictive-maintenance demonstration. It does **not** replace the purifiers (KENT, Aquaguard, etc.).

Stack: TanStack Start (React 19, Vite), TypeScript, Tailwind CSS 4, Recharts, Leaflet / OpenStreetMap,
Firebase (Auth, Firestore, Storage) with a local demo mode.

## Run it

```sh
npm install
npm run dev        # http://localhost:8080
npm run build
```

With no Firebase variables the app runs in **demo mode**: booths, complaints and tasks live in this
browser's localStorage, sensor values come from a simulator, and staff sign in with demo accounts
(password `demo1234`): `admin@trishna.demo`, `prasad@trishna.demo`, `yadav@trishna.demo`,
`singh@trishna.demo`. Demo mode has no real security. Use "Reset demo data" on `/manage` to start over.

## Pages

| Route                                       | Who    | What                                                                                                                         |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                                         | public | Overview, campus status counts, implemented vs planned                                                                       |
| `/scan`                                     | public | Scan a booth QR (camera or photo) or type a code                                                                             |
| `/booth/<ID>`                               | public | Status, TDS, pH, temperature, flow, trends, report button, nearby booths                                                     |
| `/find`                                     | public | Map + list, location only after a button tap, manual "I'm near booth…" fallback, directions                                  |
| `/report`, `/track`                         | public | File a complaint (optional photo), get a reference, track progress                                                           |
| `/admin/login`                              | staff  | Sign in                                                                                                                      |
| `/admin/dashboard` … `/admin/qr`, `/manage` | admin  | Overview, booths, complaints (verify/reject/assign), maintenance + filter service + history, risk, QR codes, add/edit booths |
| `/mts`                                      | MTS    | Assigned tasks: accept → start → notes → resolve                                                                             |

Workflow: student reports → admin verifies (booth status updates) → admin assigns → MTS accepts →
MTS starts and resolves → complaint, task, history and booth status update.

## Firebase setup

1. Create a Firebase project; enable Authentication (Email/Password), Firestore and Storage.
2. Copy `.env.example` to `.env` and fill the `VITE_FIREBASE_*` values (web app config).
3. Deploy rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes,storage`.
4. Create staff: add a user in Authentication, then a Firestore document `users/<uid>` with
   `{ name, email, role: "admin" | "mts", zone }`. The first admin must be created by hand in the console.
5. Add booths on `/manage` (or import documents into `water_booths`).

Collections: `water_booths`, `sensor_readings` (id `<boothId>_<ts>`), `complaints` (id = reference),
`maintenance_tasks`, `maintenance_history`, `users`, `device_status`. Sensor readings are written by
the hardware gateway / a Cloud Function with the Admin SDK; clients cannot write them. Security rules
are in `firestore.rules` and `storage.rules`; the UI guards are convenience only.

**Not yet tested against a live Firebase project** (none was available here). Test the rules with the
emulator before real use. Known limits: no rate limiting or CAPTCHA on public complaints; the admin
dashboard reads 7 days of readings per booth, which is fine for a prototype but should become a
Cloud Function writing summaries at scale.

## Sensor data, thresholds and safety wording

No physical sensors are connected. `src/data/simulator.ts` generates noisy, deterministic readings with
daily cycles, gaps and a few abnormal trends (flow decline, TDS rise, pH drift, offline), all labelled
`source: "simulated"`. ESP32 data would be written with `source: "hardware"` in the same shape.

Monitoring references (`src/domain/thresholds.ts`): pH 6.5–8.5; TDS 500 mg/L acceptable (the standard
allows up to 2,000 mg/L only without an alternate source). The app says "Within monitored range",
"Attention required" or "Laboratory verification recommended" and never claims water is safe: TDS and
pH cannot detect pathogens, arsenic, fluoride, pesticides or other contaminants.

## Filter life and maintenance risk

- Filter (`src/domain/filter.ts`): remaining capacity = max(0, rated − processed); remaining days =
  remaining capacity ÷ average daily usage, only with reliable usage data (≥5 days of readings).
  The service interval and rated capacity both apply, whichever comes first. Statuses: Normal,
  Service Due Soon, Service Due, Inspection Required. Admins can record a replacement (resets
  counters, stores history). It is an estimate; sensors do not prove a filter is exhausted.
- Risk (`src/domain/risk.ts`): transparent point rules (flow vs the booth's own baseline, TDS/pH,
  stale data, complaints, repeat maintenance, filter status) giving Low/Medium/High with the reason
  for every point. It is a demonstration, not a trained or validated model, and gives no failure
  date. `VITE_ML_API_URL` lets a Python/scikit-learn service replace it (`ml/README.md`).

## Implemented vs future

Implemented: everything in the table above, QR generation/printing, demo mode, Firebase adapter,
rules, indexes, role-based UI guards.
Future / not connected: ESP32 sensors and gateway, a trained ML model, laboratory-test integration,
push/email notifications, backend rate limiting.

## Deploy

GitHub → Netlify: set `NITRO_PRESET=netlify`, publish directory as in the earlier Netlify steps.
For the QR codes, print them from the deployed site so they carry the real URL.
