/** Verbatim late-entry line prepended to MA activity log notes when applicable. */
export const MA_LATE_ENTRY_HEADER = 'LATE ENTRY — Note written after date of service';

const OPENING_TEMPLATES = [
  'The clinician provided structured [task type] targeting [skill].',
  'This session focused on [skill], with the clinician [activity].',
  '[Student] participated in [activity] to address [skill].',
  'Treatment this session targeted [skill] through [activity].',
] as const;

const CUEING_PHRASES = [
  'moderate cueing',
  'maximal cueing',
  'minimal verbal prompting',
  'gestural and verbal cues',
  'independent with occasional redirection',
] as const;

const PERFORMANCE_PHRASES = [
  '[Student] achieved X% accuracy (X/X trials)',
  'Performance was noted at X% across X trials',
  'Accuracy was X% (X of X opportunities)',
  'Data reflected X% correct production across X trials',
] as const;

const CLOSING_TEMPLATES = [
  'Continued skilled SLP focus is warranted given [reason].',
  'This area will remain a treatment priority.',
  'Clinician will continue targeting [skill] given [observation].',
  'Session data support ongoing intervention targeting [skill].',
] as const;

function fnv1aHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic style bucket (0–3) from student name + service date. */
export function maNoteStyleVariantIndex(studentName: string, serviceDateYmd: string): number {
  const nameKey = studentName.trim().toLowerCase();
  const dateKey = serviceDateYmd.trim();
  return (fnv1aHash(nameKey) + fnv1aHash(dateKey)) % 4;
}

export function buildMaNoteStyleInstructions(studentName: string, serviceDateYmd: string): string {
  const i = maNoteStyleVariantIndex(studentName, serviceDateYmd);
  return `PHRASING VARIANT ${i + 1} of 4 (use for this session; do not reuse the same opener as your last note for this student if avoidable):
- Opening structure: ${OPENING_TEMPLATES[i]}
- Preferred cueing phrasing: ${CUEING_PHRASES[i % CUEING_PHRASES.length]}
- Preferred performance phrasing pattern: ${PERFORMANCE_PHRASES[i]}
- Preferred closing: ${CLOSING_TEMPLATES[i]}`;
}

const LATE_ENTRY_RE =
  /^LATE\s+ENTRY\s*[—–-]\s*Note\s+written\s+after\s+date\s+of\s+service\s*(?:\r?\n){0,2}/i;

/** Split stored note into optional late-entry header and narrative body. */
export function splitMaActivityLogNote(note: string): { lateEntryHeader?: string; body: string } {
  const trimmed = note.trim();
  if (!trimmed) return { body: '' };
  if (LATE_ENTRY_RE.test(trimmed)) {
    const body = trimmed.replace(LATE_ENTRY_RE, '').trim();
    return { lateEntryHeader: MA_LATE_ENTRY_HEADER, body };
  }
  return { body: trimmed };
}

/** Remove CPT/ICD-10 codes and billing-code phrasing from narrative (metadata row carries codes). */
export function stripBillingCodesFromMaNote(text: string): string {
  let out = text;
  const patterns: RegExp[] = [
    /\b9250[78](?:-[A-Z]{2})?\b/gi,
    /\bF80\.(?:0|1|2|89)\b/gi,
    /\bF98\.5\b/gi,
    /\bR49\.0\b/gi,
    /\bF\d{2}(?:\.\d{1,3})?\b/g,
    /\bICD-?\s*10(?:\s*code[s]?)?\s*:?\s*[A-Z]?\d[\w.]*\b/gi,
    /\bCPT\s*(?:code)?\s*:?\s*\d{5}\b/gi,
    /\(\s*9250[78]\s*\)/g,
    /\(\s*F\d{2}(?:\.\d+)?\s*\)/g,
  ];
  for (const re of patterns) {
    out = out.replace(re, '');
  }
  return out
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

export function postProcessMaActivityLogNote(
  note: string,
  opts?: { isLateEntry?: boolean }
): string {
  const { lateEntryHeader, body } = splitMaActivityLogNote(note);
  let cleaned = stripBillingCodesFromMaNote(body);
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  const parts: string[] = [];
  if (opts?.isLateEntry || lateEntryHeader) {
    parts.push(MA_LATE_ENTRY_HEADER);
  }
  if (cleaned) parts.push(cleaned);
  return parts.join('\n\n');
}
