/**
 * Calendar dates for MA billing / session reporting use America/Chicago
 * (Minnesota teletherapy), not UTC date parts from ISO strings.
 */
export const BILLING_TIMEZONE = 'America/Chicago';

function parseStoredTimestamp(raw: string): Date {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) {
    // Legacy SQLite datetime('now') — UTC without Z suffix
    return new Date(`${t.replace(' ', 'T')}Z`);
  }
  return new Date(t);
}

/** YYYY-MM-DD calendar day for an ISO timestamp or plain date string. */
export function calendarYmdInBillingTz(isoOrYmd: string): string {
  const t = (isoOrYmd || '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = parseStoredTimestamp(t);
  if (Number.isNaN(d.getTime())) return t.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: BILLING_TIMEZONE });
}

export function isYmdInRange(ymd: string, startYmd: string, endYmd: string): boolean {
  if (!ymd) return false;
  return ymd >= startYmd && ymd <= endYmd;
}

/** ISO UTC timestamp for DB storage (maLoggedAt, etc.). */
export function nowIsoUtc(): string {
  return new Date().toISOString();
}
