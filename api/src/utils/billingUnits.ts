/**
 * Minnesota DHS / CMS-style treatment units: 1 unit per 15 minutes, rounded with the 8-minute rule
 * on cumulative session minutes.
 *
 * Sessions **under 8 minutes** (e.g. consult / makeup) return **0 units** explicitly so short contacts
 * are never rounded up to a billable unit by `(m + 7) / 15` alone (which already yields 0 for 1–7 min).
 */
export function calcUnits(totalMinutes: number): number {
  const m = Math.max(0, Math.floor(totalMinutes));
  if (m > 0 && m < 8) return 0;
  return Math.floor((m + 7) / 15);
}

/** Difference in whole minutes between two ISO timestamps; 0 if invalid or end before start. */
export function sessionDurationMinutes(startIso: string, endIso: string): number {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}
