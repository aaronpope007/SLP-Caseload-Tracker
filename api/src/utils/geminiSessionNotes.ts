import { GoogleGenerativeAI } from '@google/generative-ai';
import { cptDescriptionForPrompt, cptMedicalNecessityLine } from './cptDescriptions';
import { calcUnits, sessionDurationMinutes } from './billingUnits';
import type { Icd10NarrativeContext } from './icd10NarrativeContext';
import { logger } from './logger';
import {
  buildMaLateEntryHeader,
  buildMaNoteStyleInstructions,
  postProcessMaActivityLogNote,
} from './maActivityLogNote';
import type { GoalDomainBucket } from './goalDomainMap';
import { DOMAIN_META } from './goalDomainMap';

const MN_TZ = 'America/Chicago';

export interface AddressedGoalWithDomain {
  goalId: string;
  goalDescription: string;
  domain: GoalDomainBucket;
}

export interface SessionNotePromptSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isGroup: boolean;
  cptCode: string;
  icd10Codes: string[];
  icd10Descriptions: string[];
  performanceSummary: Array<{
    goalId?: string;
    goalDescription: string;
    accuracy: number;
    correctTrials: number;
    totalTrials: number;
    cuingLevels: string[];
    notes: string;
  }>;
  goalsAddressedText: string[];
  sessionNotes: string;
  domain?: string;
  /** Per addressed IEP goal: inferred clinical domain bucket (built server-side for MA generation). */
  addressedGoalsWithDomain?: AddressedGoalWithDomain[];
  /** Optional: visit context for MA description (e.g. first session after winter break). */
  billingSessionContext?: string;
  /** Optional: expressive modality for MA description (e.g. Zoom chat, verbal, AAC). */
  communicationModalityBilling?: string;
  /** Optional: brief activities/stimuli for MA description. */
  clinicalActivitiesBilling?: string;
}

/** Fully enriched row for Minnesota MA clinical description generation (built server-side). */
export interface SoapNoteGenerationSession extends SessionNotePromptSession {
  studentName: string;
  grade: string;
  studentDob: string;
  totalMinutes: number;
  units: number;
  serviceDateYmd: string;
  noteWrittenYmd: string;
  isLateEntry: boolean;
  cptDescription: string;
  primaryIcdCode: string;
  primaryIcdDescription: string;
  iepGoalText: string;
  goalDomain: string;
  trialAccuracyPct: number;
  trialsCorrect: number;
  trialsTotal: number;
  priorSessionAccuracyPct: number | null;
  promptingLevel: string;
  modality: string;
  /** When duration is positive but under 8 min: warn in prompt that units are 0 and billing should be verified. */
  shortSessionBillingNote?: string;
  narrativeContext: Icd10NarrativeContext | null;
  cptJustification: string;
}

export interface SoapNoteProviderInfo {
  providerName: string;
  credentials: string;
  npiNumber: string;
}

function formatYmdInTz(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

/** 12-hour clock in Minnesota timezone (matches DHS-style notes; avoids models misreading Zulu ISO as local). */
function formatClockMn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleTimeString('en-US', {
    timeZone: MN_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calendar date of service in Minnesota (America/Chicago).
 * Plain `YYYY-MM-DD` is treated as that calendar day (not UTC midnight), matching session log date columns.
 */
function billingServiceYmdFromSessionInput(dateOrStartIso: string): string {
  const t = dateOrStartIso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t.slice(0, 10);
  return formatYmdInTz(d, MN_TZ);
}

function todayYmdChicago(): string {
  return formatYmdInTz(new Date(), MN_TZ);
}

function formatDisplayDate(ymd: string): string {
  const [y, mo, da] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!y || !mo || !da) return ymd;
  // Use UTC noon so the instant falls on the intended calendar day in Chicago (UTC midnight would map to the prior evening in Central).
  const d = new Date(Date.UTC(y, mo - 1, da, 12, 0, 0));
  return d.toLocaleDateString('en-US', { timeZone: MN_TZ, month: 'numeric', day: 'numeric', year: 'numeric' });
}

export function promptingLevelFromAccuracy(accuracy: number): string {
  if (accuracy >= 90) return 'Independent';
  if (accuracy >= 80) return 'Minimal';
  if (accuracy >= 50) return 'Moderate';
  return 'Maximal';
}

function primaryTrialBlock(s: SessionNotePromptSession): {
  trialAccuracyPct: number;
  trialsCorrect: number;
  trialsTotal: number;
  iepGoalText: string;
} {
  if (s.performanceSummary.length > 0) {
    const p = s.performanceSummary[0];
    const addr = (s.goalsAddressedText || []).map((x) => x.trim()).filter(Boolean).slice(0, 3).join('; ');
    return {
      trialAccuracyPct: Math.round(Number(p.accuracy) || 0),
      trialsCorrect: Math.max(0, Math.round(Number(p.correctTrials) || 0)),
      trialsTotal: Math.max(0, Math.round(Number(p.totalTrials) || 0)),
      iepGoalText: (p.goalDescription || '').trim() || addr || 'IEP communication targets per session export',
    };
  }
  const g = (s.goalsAddressedText || []).map((x) => x.trim()).filter(Boolean).slice(0, 4).join('; ');
  return {
    trialAccuracyPct: 0,
    trialsCorrect: 0,
    trialsTotal: 0,
    iepGoalText: g || 'IEP communication targets per session export',
  };
}

const DOMAIN_FOCUS_BUCKETS = ['articulation', 'language', 'pragmatics'] as const;

function formatSessionFocusByDomain(goals: AddressedGoalWithDomain[]): string {
  const buckets: Record<(typeof DOMAIN_FOCUS_BUCKETS)[number], string[]> = {
    articulation: [],
    language: [],
    pragmatics: [],
  };
  const unknownGoals: string[] = [];

  for (const g of goals) {
    const text = g.goalDescription.trim();
    if (!text) continue;
    if (g.domain === 'unknown') {
      unknownGoals.push(text);
    } else if (g.domain in buckets) {
      buckets[g.domain as (typeof DOMAIN_FOCUS_BUCKETS)[number]].push(text);
    }
  }

  const domainLine = (label: string, items: string[]) =>
    `- ${label}: ${items.length > 0 ? items.join(', ') : 'none this session'}`;

  const lines = [
    'Session focus by clinical domain:',
    domainLine('Articulation goals addressed', buckets.articulation),
    domainLine('Language goals addressed', buckets.language),
    domainLine('Pragmatics goals addressed', buckets.pragmatics),
  ];

  if (unknownGoals.length > 0) {
    lines.push(`- Other goals addressed: ${unknownGoals.join(', ')}`);
  }

  lines.push(
    '',
    'When writing the note, emphasize only the domains that have goals listed above (not "none this session").',
    'Do not reference domains marked "none this session".',
    'Do not include ICD-10 codes or CPT codes in the note body.'
  );

  return lines.join('\n');
}

function formatPerformanceByGoal(summary: SessionNotePromptSession['performanceSummary']): string {
  if (!summary.length) return '(none)';
  return summary
    .map((p) => {
      const gid = p.goalId ? ` [goalId: ${p.goalId}]` : '';
      const cues = Array.isArray(p.cuingLevels) ? p.cuingLevels.join(', ') : '';
      const n = p.notes?.trim() ? ` | Notes: ${p.notes.trim()}` : '';
      return `  • ${p.goalDescription}${gid}: ${p.accuracy}% (${p.correctTrials}/${p.totalTrials} trials); cues: ${cues || '—'}${n}`;
    })
    .join('\n');
}

function buildSoapSessionsBlock(sessions: SoapNoteGenerationSession[]): string {
  const parts: string[] = [];
  for (const s of sessions) {
    const lateLine = s.isLateEntry
      ? buildMaLateEntryHeader(s.serviceDateYmd, {
          startTime: s.startTime,
          endTime: (s.endTime || '').trim() || s.startTime,
          isGroup: s.isGroup,
        })
      : '(not a late entry — omit late-entry line from header)';
    const endIso = (s.endTime || '').trim() || s.startTime;
    const sessionTimeCentral = `${formatClockMn(s.startTime)} – ${formatClockMn(endIso)}`;

    const encounterIcd = (s.icd10Codes || []).length > 0 ? s.icd10Codes.join(', ') : '—';

    const serviceTypeName = s.isGroup ? 'group speech-language treatment' : 'individual speech-language treatment';

    const goalsSection =
      s.addressedGoalsWithDomain && s.addressedGoalsWithDomain.length > 0
        ? `
${formatSessionFocusByDomain(s.addressedGoalsWithDomain)}`
        : `
CLINICAL CONTEXT: Use session notes and goal targets; do not invent unsupported diagnoses or write billing codes in the note.`;

    const targetsLine =
      s.addressedGoalsWithDomain && s.addressedGoalsWithDomain.length > 0
        ? s.addressedGoalsWithDomain.map((g) => g.goalDescription).join('; ')
        : s.iepGoalText;

    const ctxBlock = `
- Service type (name only in note): ${serviceTypeName}
- Target skill(s): ${targetsLine}
- Therapy activities: ${(s.clinicalActivitiesBilling || '').trim() || 'Not specified — infer one plausible structured activity from targets and session notes (e.g. sentence-level production, minimal pairs, word-level drill, conversational probing)'}
- Session context: ${(s.billingSessionContext || '').trim() || 'Not specified — use only if supported by session notes'}
- Communication modality: ${(s.communicationModalityBilling || '').trim() || 'teletherapy via Zoom (infer verbal/chat/AAC from session notes if stated)'}
- Clinician notes: ${(s.sessionNotes || '').trim() || 'None recorded'}`;

    const multiPerf = s.performanceSummary.length > 1;
    const trialDataRule = multiPerf
      ? `Session data (per goal — include all numbers provided; do not fabricate):\n${formatPerformanceByGoal(s.performanceSummary)}\nOverall cueing tone: ${s.promptingLevel}.`
      : s.trialsTotal > 0
        ? `Session data: ${s.trialsCorrect}/${s.trialsTotal} trials; ${s.trialAccuracyPct}% accuracy; cueing: ${s.promptingLevel}.${s.priorSessionAccuracyPct != null ? ` Prior session: ${s.priorSessionAccuracyPct}%.` : ''}`
        : `Session data: No formal trial data provided — state that formal data were not collected and describe the qualitative observation from session notes. Do NOT write "0/0 trials" or "0 trials".`;

    const styleBlock = buildMaNoteStyleInstructions(s.studentName, s.serviceDateYmd);

    const dobSeg = (s.studentDob || '').trim();
    const studentLine = dobSeg
      ? `${s.studentName}, DOB: ${dobSeg}`
      : s.studentName;

    const block = `
SESSION ID: ${s.id}
- Student: ${studentLine}
- Grade: ${s.grade}
- Date of Service: ${formatDisplayDate(s.serviceDateYmd)}
- Late entry: ${lateLine}
- Session Time (Central): ${sessionTimeCentral} (${s.totalMinutes} minutes)
- Delivery: teletherapy via Zoom
${s.shortSessionBillingNote ? `- ${s.shortSessionBillingNote}\n` : ''}
BILLING METADATA (already shown in SpedForms above the note — NEVER include CPT or ICD-10 codes in the "note" text):
- CPT: ${s.cptCode} — ${s.cptDescription}
- ICD-10 on encounter: ${encounterIcd}
- Units: ${s.units}

${trialDataRule}
${goalsSection}
${ctxBlock}

${styleBlock}
`.trim();
    parts.push(block);
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Full MA activity log note prompt (one or more sessions). Shared with Gemini and Anthropic.
 * The JSON "note" is pasted into the SpedForms description field (codes live in metadata row).
 */
export function buildSoapGenerationPrompt(
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): string {
  const dataBlock = buildSoapSessionsBlock(sessions);
  return `You are a licensed speech-language pathologist writing a clinical activity log note for Minnesota Medicaid (MA) billing documentation. Services are delivered via teletherapy (Zoom).

The JSON field **"note"** is the **only narrative** pasted into the MA activity log description. CPT and ICD-10 codes are already entered in separate SpedForms fields above this text.

OUTPUT FORMAT:
- **One paragraph only** for the clinical narrative (no bullet points, no headers, no SOAP sections).
- **80–130 words** for the narrative (max ~150 words). Third person, past tense, clinical but readable.
- If late entry: first line MUST match the "Late entry:" line from SESSION DATA exactly (e.g. \`LATE ENTRY — Note written after date of service (scheduled M/D/YYYY H:MM-H:MM) (group)\` or \`(individual)\`), then one blank line, then the paragraph.
- If not a late entry: no late-entry line — start with the paragraph only.

MUST INCLUDE IN THE PARAGRAPH:
1. **Service type by name** — "individual speech-language treatment" or "group speech-language treatment" (and group context when applicable); teletherapy via Zoom.
2. **At least one specific therapy activity** — use Therapy activities from SESSION DATA, or infer a plausible structured task from targets (sentence-level production, minimal pairs, word-level drill, conversational probing, structured elicitation).
3. **Session data** — include every accuracy %, trial count, and prior-session comparison provided in SESSION DATA. If no trial data, state that formal trial data were not collected and give a qualitative observation. **Do not fabricate numbers.**
4. **Domain emphasis** — when SESSION DATA includes "Session focus by clinical domain", emphasize only domains with listed goals (not "none this session"). Do not name or discuss domains marked "none this session".
5. **Cueing** — use the PHRASING VARIANT cueing language when consistent with SESSION DATA.
6. **Closing** — one sentence on rationale for continued treatment (use PHRASING VARIANT closing pattern).

MUST NOT INCLUDE IN THE "note" TEXT:
- **Any CPT code** (e.g. 92507, 92508) or **any ICD-10 code** (e.g. F80.0, F80.1, F80.2, F80.89, F98.5, R49.0) or the phrases "ICD-10" / "CPT".
- Provider name, NPI, or signature block.
- The phrase "communication goals per IEP".

VARIETY:
- Follow the **PHRASING VARIANT** block for each session (opening, cueing, performance phrasing, closing).
- Vary wording across sessions; do not start every note with "The clinician".

Return a single JSON array only (root = array).
Each element: { "sessionId": "<exact SESSION ID>", "note": "<late-entry line if applicable, then one paragraph>" }.
Use each SESSION ID verbatim. Do not rename or invent ids.

SESSION DATA (per session separated by ---):
${dataBlock}
`;
}

/** Single-session prompt — same wording as {@link buildSoapGenerationPrompt} with one session. */
export function buildSoapPrompt(session: SoapNoteGenerationSession, provider: SoapNoteProviderInfo): string {
  return buildSoapGenerationPrompt([session], provider);
}

/** Free-tier quota for flash-lite is often exhausted; never prefer these IDs. */
function isFlashLiteModel(modelId: string): boolean {
  const x = modelId.toLowerCase();
  return x.includes('flash-lite') || x.includes('flash_lite');
}

async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = (await response.json()) as {
      models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
    };
    if (data.models) {
      return data.models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((m) => !m.toLowerCase().includes('tts'))
        .filter((m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest'))
        .filter((m) => !isFlashLiteModel(m));
    }
  } catch {
    // ignore
  }
  return [];
}

/** Prefer stable non-lite Flash IDs first (work even if omitted from ListModels). */
const SOAP_NOTE_MODEL_TRY_ORDER = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash-preview',
  'gemini-3-flash-preview',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

function buildSoapNoteModelTryList(available: string[]): string[] {
  const fromApi = available.filter((m) => !isFlashLiteModel(m));
  const merged = [...SOAP_NOTE_MODEL_TRY_ORDER, ...fromApi.filter((m) => !SOAP_NOTE_MODEL_TRY_ORDER.includes(m))];
  return [...new Set(merged)].slice(0, 8);
}

/** Slice one top-level `[ ... ]` from text, respecting JSON string quoting. */
function sliceTopLevelJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function unwrapNotesArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  for (const key of ['notes', 'sessions', 'data', 'results', 'items', 'response']) {
    const v = o[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

/** Parse model output: markdown fences, preamble, wrapper objects, top-level array slice. */
export function parseSessionNotesAiResponse(rawText: string): unknown[] {
  const trimmed = rawText.trim();
  const candidates: string[] = [];
  const reFence = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = reFence.exec(trimmed)) !== null) {
    const inner = m[1].trim();
    if (inner) candidates.push(inner);
  }
  candidates.push(trimmed);
  const sliced = sliceTopLevelJsonArray(trimmed);
  if (sliced && !candidates.includes(sliced)) candidates.push(sliced);

  let lastErr: Error | null = null;
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      const arr = unwrapNotesArray(parsed);
      if (arr) return arr;
      lastErr = new Error('Response JSON was not an array and had no known wrapper key');
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error('Failed to parse JSON');
}

export function resolveKnownSessionId(raw: string, known: Set<string>): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (known.has(t)) return t;
  const lower = t.toLowerCase();
  for (const id of known) {
    if (id.toLowerCase() === lower) return id;
  }
  return null;
}

/**
 * Minnesota MA clinical description (Gemini Flash), one description per session.
 */
export async function generateSessionNotesWithGemini(
  apiKey: string,
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): Promise<Array<{ sessionId: string; note: string }>> {
  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is required (set GEMINI_API_KEY)');
  }
  if (sessions.length === 0) {
    return [];
  }

  let available = await getAvailableModels(apiKey);
  available = available.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (available.length === 0) {
    available = ['gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];
  }

  const tryModels = buildSoapNoteModelTryList(available);
  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = buildSoapGenerationPrompt(sessions, provider);

  const knownSessionIds = new Set(sessions.map((s) => s.id));

  let lastErr: Error | null = null;
  for (const name of tryModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        generationConfig: {
          maxOutputTokens: 8192,
          // Ask Gemini for valid JSON so multiline description text is escaped correctly.
          responseMimeType: 'application/json',
        } as { maxOutputTokens: number; responseMimeType?: string },
      });
      const result = await model.generateContent(prompt);
      const text = (await result.response).text();
      let parsedArr: unknown[];
      try {
        parsedArr = parseSessionNotesAiResponse(text);
      } catch {
        throw new Error('Failed to parse AI response');
      }

      const out: Array<{ sessionId: string; note: string }> = [];
      for (const row of parsedArr) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const rawSid = r.sessionId ?? r.session_id;
        const sessionId = resolveKnownSessionId(
          typeof rawSid === 'string' ? rawSid : String(rawSid ?? ''),
          knownSessionIds
        );
        const rawNote = r.note;
        const note =
          typeof rawNote === 'string' ? rawNote.trim() : rawNote != null ? String(rawNote).trim() : '';
        if (!sessionId || !note) continue;
        const sessionRow = sessions.find((x) => x.id === sessionId);
        const processed = postProcessMaActivityLogNote(note, {
          isLateEntry: sessionRow?.isLateEntry,
          serviceDateYmd: sessionRow?.serviceDateYmd,
          startTime: sessionRow?.startTime,
          endTime: sessionRow?.endTime,
          isGroup: sessionRow?.isGroup,
        });
        out.push({ sessionId, note: processed });
      }

      if (out.length === 0) {
        throw new Error('Failed to parse AI response');
      }

      return out;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }

  throw lastErr || new Error('Gemini request failed');
}

/** Build enriched SOAP rows + provider defaults (used by sessions route). */
export function buildSoapNoteGenerationSession(
  studentName: string,
  grade: string,
  studentDob: string,
  bodySession: SessionNotePromptSession,
  goalMeta: { description: string; domain: string } | null,
  priorSessionAccuracyPct: number | null
): SoapNoteGenerationSession {
  const totalMinutes = sessionDurationMinutes(bodySession.startTime, bodySession.endTime || bodySession.startTime);
  const units = calcUnits(totalMinutes);
  const serviceDateYmd = billingServiceYmdFromSessionInput(bodySession.startTime || bodySession.date);
  const noteWrittenYmd = todayYmdChicago();
  const isLateEntry = serviceDateYmd !== noteWrittenYmd;
  const trial = primaryTrialBlock(bodySession);
  const promptingLevel = promptingLevelFromAccuracy(trial.trialAccuracyPct);
  const modality = bodySession.isGroup ? 'Group Teletherapy via Zoom' : 'Individual Teletherapy via Zoom';
  const addrGoals = (bodySession.goalsAddressedText || []).map((x) => x.trim()).filter(Boolean).slice(0, 4).join('; ');
  const addressed = bodySession.addressedGoalsWithDomain;

  const iepGoalText =
    (addressed && addressed.length > 0 && addressed[0].goalDescription?.trim()) ||
    goalMeta?.description?.trim() ||
    trial.iepGoalText ||
    addrGoals ||
    'IEP communication targets per session export';
  const goalDomain =
    (addressed && addressed.length > 0 && DOMAIN_META[addressed[0].domain]?.label) ||
    goalMeta?.domain ||
    bodySession.domain ||
    'communication';

  const primaryIcdCode = bodySession.icd10Codes[0] || '';
  const primaryIcdDescription = bodySession.icd10Descriptions[0] || '';

  const cptJustification = cptMedicalNecessityLine(bodySession.cptCode, modality);
  const shortSessionBillingNote =
    totalMinutes > 0 && totalMinutes < 8
      ? 'BILLING NOTICE: Session is under 8 minutes; units billed are 0. Confirm whether this was a consult, non-billable contact, or documentation-only before claiming treatment units.'
      : undefined;

  return {
    ...bodySession,
    studentName,
    grade,
    studentDob: (studentDob || '').trim(),
    totalMinutes,
    units,
    serviceDateYmd,
    noteWrittenYmd,
    isLateEntry,
    cptDescription: cptDescriptionForPrompt(bodySession.cptCode),
    primaryIcdCode,
    primaryIcdDescription,
    iepGoalText,
    goalDomain,
    trialAccuracyPct: trial.trialAccuracyPct,
    trialsCorrect: trial.trialsCorrect,
    trialsTotal: trial.trialsTotal,
    priorSessionAccuracyPct,
    promptingLevel,
    modality,
    shortSessionBillingNote,
    narrativeContext: null,
    cptJustification,
  };
}

export function genericSessionNote(
  domain: string | undefined,
  opts?: { isGroup?: boolean }
): string {
  const d = (domain || '').trim() || 'speech and language';
  const service =
    opts?.isGroup === true
      ? 'group speech-language treatment'
      : 'individual speech-language treatment';
  const goalPhrase = d.toLowerCase().includes('communication') ? d : `${d} communication`;
  return `The clinician provided structured teletherapy via Zoom during ${service}, targeting ${goalPhrase} per IEP. Formal trial data were not collected during this session; participation was observed qualitatively and should be summarized from the session log before billing. Session data support ongoing skilled intervention targeting ${goalPhrase}.`;
}
