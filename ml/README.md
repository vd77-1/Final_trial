# Optional ML risk service (not included yet)

The app scores maintenance risk with transparent rules in `src/domain/risk.ts`. To use a trained
model instead, run a small Python service (FastAPI/Flask + scikit-learn) and set `VITE_ML_API_URL`.

**Request** `POST` JSON: `{ "features": { tdsPpm, ph, temperatureC, flowLpm, tdsRolling6, flowRolling6,
tdsChange24hPct, tdsChange7dPct, flowChange24hPct, flowVsBaselinePct, staleHours, openComplaints,
complaints30d, maintenanceEvents60d, cumulativeProcessedL }` (any value may be null).

**Response** JSON: `{ "level": "Low"|"Medium"|"High", "score": 0-100, "reasons": [{ "text": "...", "points": 0 }] }`

Training needs real, labelled failure/maintenance history exported from `sensor_readings`,
`complaints` and `maintenance_history` with Pandas. Until that exists, the rules engine is the
honest option: simulated data cannot validate a model. Serve the service over HTTPS and enable CORS
for your site only.
