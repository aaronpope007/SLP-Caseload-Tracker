import { BILLING_TIMEZONE } from './billingTimezone';

const MN_TZ = BILLING_TIMEZONE;

/** Display date for late-entry header (M/D/YYYY in Minnesota timezone). */
export function formatMaServiceDateDisplay(ymd: string): string {
  const t = ymd.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, mo, da] = t.split('-').map((x) => parseInt(x, 10));
    if (y && mo && da) {
      const d = new Date(Date.UTC(y, mo - 1, da, 12, 0, 0));
      return d.toLocaleDateString('en-US', {
        timeZone: MN_TZ,
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return t;
}

/** Compact clock for late-entry header, e.g. 11:00 (Central; no AM/PM). */
function formatMaSessionClockCompact(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MN_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  if (!hour) return '';
  return `${hour}:${minute}`;
}

/** Session time range for late-entry header, e.g. 11:00-11:20. */
export function formatMaSessionTimeRangeMn(startIso: string, endIso?: string): string {
  const start = formatMaSessionClockCompact(startIso);
  if (!start) return '';
  const endRaw = (endIso ?? '').trim() || startIso;
  const end = formatMaSessionClockCompact(endRaw);
  if (!end || end === start) return start;
  return `${start}-${end}`;
}

export interface MaLateEntryHeaderOptions {
  startTime?: string;
  endTime?: string;
  isGroup?: boolean;
}

/** Late-entry header: scheduled date/time plus (group) or (individual). */
export function buildMaLateEntryHeader(
  serviceDateYmd: string,
  opts?: MaLateEntryHeaderOptions
): string {
  const dateDisplay = formatMaServiceDateDisplay(serviceDateYmd);
  const timeRange = opts?.startTime?.trim()
    ? formatMaSessionTimeRangeMn(opts.startTime, opts.endTime)
    : '';
  const scheduled = timeRange ? `scheduled ${dateDisplay} ${timeRange}` : dateDisplay;
  const serviceLabel = opts?.isGroup === true ? 'group' : 'individual';
  return `LATE ENTRY — Note written after date of service (${scheduled}) (${serviceLabel})`;
}

/** @deprecated Use {@link buildMaLateEntryHeader} with service date. Legacy notes may omit the date. */
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

const LATE_ENTRY_LINE_RE =
  /^LATE\s+ENTRY\s*[—–-]\s*Note\s+written\s+after\s+date\s+of\s+service/i;

/** Split stored note into optional late-entry header and narrative body. */
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
  opts?: {
    isLateEntry?: boolean;
    serviceDateYmd?: string;
    startTime?: string;
    endTime?: string;
    isGroup?: boolean;
  }
): string {
  const { lateEntryHeader, body } = splitMaActivityLogNote(note);
  let cleaned = stripBillingCodesFromMaNote(body);
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  const parts: string[] = [];
  if (opts?.isLateEntry || lateEntryHeader) {
    const header = opts?.serviceDateYmd?.trim()
      ? buildMaLateEntryHeader(opts.serviceDateYmd, {
          startTime: opts.startTime,
          endTime: opts.endTime,
          isGroup: opts.isGroup,
        })
      : (lateEntryHeader ?? MA_LATE_ENTRY_HEADER);
    parts.push(header);
  }
  if (cleaned) parts.push(cleaned);
  return parts.join('\n\n');
}
