/** Client helpers for MA activity log note display (keep in sync with api/src/utils/maActivityLogNote.ts). */

const LATE_ENTRY_LINE_RE =
  /^LATE\s+ENTRY\s*[—–-]\s*Note\s+written\s+after\s+date\s+of\s+service/i;

export function splitMaActivityLogNote(note: string): { lateEntryHeader?: string; body: string } {
  const trimmed = note.trim();
  if (!trimmed) return { body: '' };
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  if (LATE_ENTRY_LINE_RE.test(firstLine)) {
    const nl = trimmed.indexOf('\n');
    const body = nl >= 0 ? trimmed.slice(nl + 1).replace(/^\r?\n/, '').trim() : '';
    return { lateEntryHeader: firstLine, body };
  }
  return { body: trimmed };
}
