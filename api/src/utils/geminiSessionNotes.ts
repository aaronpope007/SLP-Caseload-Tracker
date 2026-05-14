import { GoogleGenerativeAI } from '@google/generative-ai';
import { cptDescriptionForPrompt, cptMedicalNecessityLine } from './cptDescriptions';
import { calcUnits, sessionDurationMinutes } from './billingUnits';
import type { Icd10NarrativeContext } from './icd10NarrativeContext';
import { getNarrativeContext } from './icd10NarrativeContext';
import { logger } from './logger';

const MN_TZ = 'America/Chicago';

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
}

/** Fully enriched row for Minnesota DHS SOAP generation (built server-side). */
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
  const d = new Date(Date.UTC(y, mo - 1, da));
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
    return {
      trialAccuracyPct: Math.round(Number(p.accuracy) || 0),
      trialsCorrect: Math.max(0, Math.round(Number(p.correctTrials) || 0)),
      trialsTotal: Math.max(0, Math.round(Number(p.totalTrials) || 0)),
      iepGoalText: (p.goalDescription || '').trim() || 'Communication goals per IEP',
    };
  }
  const g = (s.goalsAddressedText[0] || '').trim();
  return {
    trialAccuracyPct: 0,
    trialsCorrect: 0,
    trialsTotal: 0,
    iepGoalText: g || 'Communication goals per IEP',
  };
}

function buildSoapSessionsBlock(
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): string {
  const parts: string[] = [];
  for (const s of sessions) {
    const lateLine = s.isLateEntry
      ? `Date Note Written: ${formatDisplayDate(s.noteWrittenYmd)} (LATE ENTRY)`
      : '(not a late entry — omit late-entry line from header)';
    const prior =
      s.priorSessionAccuracyPct != null
        ? `${s.priorSessionAccuracyPct}%`
        : 'Not available — omit prior-session comparison or state no prior data.';

    const endIso = (s.endTime || '').trim() || s.startTime;
    const sessionTimeCentral = `${formatClockMn(s.startTime)} – ${formatClockMn(endIso)}`;

    const diagnosisCtxLines = s.narrativeContext
      ? `
DIAGNOSIS CONTEXT (shape Subjective, Objective, Assessment, Plan; Assessment MUST integrate medical necessity below):
- Deficit Description: ${s.narrativeContext.deficitDescription}
- Skill Targeted: ${s.narrativeContext.skillTargeted}
- Academic Impact: ${s.narrativeContext.academicImpact}
- Medical Necessity (use in Assessment): ${s.narrativeContext.medicalNecessityRationale}`
      : `
DIAGNOSIS CONTEXT: No structured narrative map for ICD-10 ${s.primaryIcdCode || '—'}. Use the ICD-10 label/description in SESSION DATA and the IEP goal domain to justify skilled SLP services; do not invent unsupported diagnoses.`;

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
- CPT Code: ${s.cptCode} — ${s.cptDescription}
- ICD-10: ${s.primaryIcdCode || '—'} — ${s.primaryIcdDescription || '—'}
- Session Time (Central / America/Chicago): ${sessionTimeCentral} (${s.totalMinutes} minutes)
${s.shortSessionBillingNote ? `- ${s.shortSessionBillingNote}\n` : ''}- Units Billed: ${s.units} (8-minute rule / 15-min units)
- Setting: ${s.modality}
- Goal domain (for interventions): ${s.goalDomain || s.domain || 'communication'}
- IEP Goal Targeted: ${s.iepGoalText}
- Trial Accuracy This Session: ${s.trialAccuracyPct}% (${s.trialsCorrect}/${s.trialsTotal} trials)
- Prior Session Accuracy (if available): ${prior}
- Clinician Prompting Level Used: ${s.promptingLevel} (derive from session rules; do not contradict)
- Session / clinician notes (verbatim context): ${(s.sessionNotes || '').trim() || 'None recorded'}${diagnosisCtxLines}

CPT JUSTIFICATION (integrate into Assessment; must align with CPT on file above):
${s.cptJustification}
`.trim();
    parts.push(block);
  }

  const prov = `
PROVIDER (signature block — use exactly; do not invent NPI):
- Name: ${provider.providerName || '[Configure in Settings]'}
- Credentials: ${provider.credentials || ''}
- NPI: ${provider.npiNumber || ''}
`.trim();

  return `${parts.join('\n\n---\n\n')}\n\n${prov}`;
}

/**
 * Full SOAP generation user prompt (one or more sessions). Same content as previously built inside
 * {@link generateSessionNotesWithGemini}; shared with Anthropic fallback.
 */
export function buildSoapGenerationPrompt(
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): string {
  const dataBlock = buildSoapSessionsBlock(sessions, provider);
  return `You are a licensed school-based Speech-Language Pathologist writing Minnesota DHS-compliant SOAP progress notes for MA billing audit purposes.

CRITICAL INSTRUCTIONS:
- The ICD-10 and CPT codes in each SESSION DATA block are already determined. Your job is to write a note whose narrative **justifies those exact codes**.
- Use each session's DIAGNOSIS CONTEXT (when provided) to shape Subjective, Objective, Assessment, and Plan. When DIAGNOSIS CONTEXT says no map is available, still tie narrative to the documented ICD-10 label/description and IEP goal domain.
- The **Assessment** section MUST: (1) reference the student's communication deficit using language consistent with DIAGNOSIS CONTEXT (or the documented ICD-10 label when no map), (2) interpret trial data vs. Prior Session Accuracy when available, (3) state why skilled SLP remains necessary using the Medical Necessity line from DIAGNOSIS CONTEXT or clinically equivalent wording aligned to that diagnosis, (4) explicitly incorporate the **CPT JUSTIFICATION** paragraph for service format (individual vs group, teletherapy).
- Do **not** fabricate trial accuracy, diagnoses, or outcomes not supported by SESSION DATA. Use only the accuracy, trial counts, prompting level, and prior session accuracy given.
- **Objective — Interventions** must match the **goal domain** and diagnosis-linked deficits (not generic boilerplate). For teletherapy, reference Zoom-based delivery where appropriate.

For each session, follow this exact output structure (plain text inside the JSON "note" string, with line breaks as shown):

STUDENT: [name][if SESSION DATA "Student:" line includes ", DOB:", include " | DOB: [same dob] | "; if there is no DOB on that line, omit any DOB segment] | DATE OF SERVICE: [use the M/D/YYYY shown after "Date of Service:" in SESSION DATA exactly]
[If late entry per SESSION DATA, start this line with: LATE ENTRY — DATE NOTE WRITTEN: [today M/D/YYYY] | ]CPT: [code from SESSION DATA] | ICD-10: [primary code from SESSION DATA]
SESSION: [copy the start and end clocks from the "Session Time (Central / America/Chicago):" line in SESSION DATA verbatim, same 12-hour format and en dash between them] ([X] min) | UNITS BILLED: [X] | SETTING: [modality from data]

S – SUBJECTIVE
[Student status, transition, engagement, readiness. Tie to diagnosis-linked academic/functional impact where appropriate. 2–3 sentences.]

O – OBJECTIVE
IEP Goal Targeted: [goal text from data]
Interventions: [strategies aligned with goal domain AND diagnosis context — teletherapy/Zoom-appropriate]
Data: Student achieved [X]% accuracy ([correct]/[total] trials) with [prompting level] clinician support.

A – ASSESSMENT
[Meet the four Assessment requirements in CRITICAL INSTRUCTIONS above. 3–5 sentences.]

P – PLAN
Continue speech-language therapy per IEP schedule. Next session will [advance/maintain/modify] targets based on today's performance.

[Provider name], [credentials]
NPI: [NPI from PROVIDER block; if blank write "NPI: Pending configuration"]

Return a single JSON array only (the document root must be an array, not an object).
Each element must be: { "sessionId": "<exact SESSION ID from SESSION DATA>", "note": "<full SOAP note>" }.
Use each SESSION ID verbatim from the SESSION DATA blocks (SESSION ID: ... line). Do not rename or invent ids.
Do not convert or reinterpret times from any other format; the line beginning "Session Time (Central" in SESSION DATA is authoritative for the SOAP SESSION header.

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
 * Minnesota DHS-style SOAP progress notes (Gemini Flash), one note per session.
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
          // Ask Gemini for valid JSON so multiline SOAP notes are escaped correctly.
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
        out.push({ sessionId, note });
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
  const primaryIcdCode = bodySession.icd10Codes[0] || '';
  const primaryIcdDescription = bodySession.icd10Descriptions[0] || '';
  const narrativeContext = getNarrativeContext(primaryIcdCode);
  const cptJustification = cptMedicalNecessityLine(bodySession.cptCode, modality);
  if (primaryIcdCode && !narrativeContext) {
    logger.warn(
      { primaryIcdCode, sessionId: bodySession.id },
      'ICD-10 code has no narrative map entry; SOAP prompt uses generic diagnosis guidance — add to icd10NarrativeMap if needed'
    );
  }
  const iepGoalText =
    goalMeta?.description?.trim() ||
    trial.iepGoalText ||
    (bodySession.goalsAddressedText[0] || '').trim() ||
    'Communication goals per IEP';
  const goalDomain = (goalMeta?.domain || bodySession.domain || '').trim() || 'communication';

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
    narrativeContext,
    cptJustification,
  };
}

export function genericSessionNote(
  domain: string | undefined,
  opts?: { icd10Code?: string; cptCode?: string }
): string {
  const d = (domain || '').trim() || 'communication';
  const today = formatDisplayDate(todayYmdChicago());
  const icd = (opts?.icd10Code || '').trim();
  const cpt = (opts?.cptCode || '92507').trim();
  const ctx = icd ? getNarrativeContext(icd) : null;
  const icdHeader = icd || '—';
  const diagnosisLabel = ctx?.diagnosisLabel || (icd ? `ICD-10 ${icd}` : 'Communication needs per IEP');
  const medOneLine =
    ctx?.medicalNecessityRationale ||
    'Skilled speech-language pathology services remain medically necessary per the IEP to support functional communication and educational access.';
  const modality = cpt === '92508' ? 'Group Teletherapy via Zoom' : 'Individual Teletherapy via Zoom';
  const cptJust = cptMedicalNecessityLine(cpt, modality);
  return `STUDENT: Student | DATE OF SERVICE: ${today}
CPT: ${cpt} | ICD-10: ${icdHeader} — ${diagnosisLabel}
SESSION: — (0 min) | UNITS BILLED: 0 | SETTING: ${modality}

S – SUBJECTIVE
Student participated in a speech-language therapy session as documented; narrative below aligns to billed codes (${cpt} / ${icdHeader}).

O – OBJECTIVE
IEP Goal Targeted: ${d} goals per IEP.
Interventions: ${ctx ? `Activities aligned with ${ctx.skillTargeted} and teletherapy delivery.` : 'Activities aligned with documented communication goals and teletherapy service delivery.'}
Data: Session documentation did not include trial-level data in the export used for note generation.

A – ASSESSMENT
Insufficient structured trial data were available to quantify progress this session. ${medOneLine} ${cptJust}

P – PLAN
Continue speech-language therapy per IEP schedule. Next session will maintain targets until quantitative data are available.

Clinician
NPI: Pending configuration`;
}
