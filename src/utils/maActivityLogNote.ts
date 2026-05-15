/** Client helpers for MA activity log note display (keep in sync with api/src/utils/maActivityLogNote.ts). */

export const MA_LATE_ENTRY_HEADER = 'LATE ENTRY — Note written after date of service';

const LATE_ENTRY_RE =
  /^LATE\s+ENTRY\s*[—–-]\s*Note\s+written\s+after\s+date\s+of\s+service\s*(?:\r?\n){0,2}/i;

export function splitMaActivityLogNote(note: string): { lateEntryHeader?: string; body: string } {
  const trimmed = note.trim();
  if (!trimmed) return { body: '' };
  if (LATE_ENTRY_RE.test(trimmed)) {
    const body = trimmed.replace(LATE_ENTRY_RE, '').trim();
    return { lateEntryHeader: MA_LATE_ENTRY_HEADER, body };
  }
  return { body: trimmed };
}
