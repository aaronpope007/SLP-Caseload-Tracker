import { GoogleGenerativeAI } from '@google/generative-ai';
import { cptDescriptionForPrompt, cptMedicalNecessityLine } from './cptDescriptions';
import { calcUnits, sessionDurationMinutes } from './billingUnits';
import type { Icd10NarrativeContext } from './icd10NarrativeContext';
import { getNarrativeContext } from './icd10NarrativeContext';
import { logger } from './logger';

const MN_TZ = 'America/Chicago';

export interface AddressedGoalWithIcd {
  goalId: string;
  goalDescription: string;
  domain: string | null;
  icd10Codes: string[];
  icd10Descriptions: string[];
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
  /** Per addressed IEP goal: domain-mapped billing ICD-10 (built server-side for MA generation). */
  addressedGoalsWithIcd?: AddressedGoalWithIcd[];
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

function formatAddressedGoalsForPrompt(goals: AddressedGoalWithIcd[]): string {
  return goals
    .map((g, i) => {
      const icdLines = g.icd10Codes.map((code, j) => {
        const desc = g.icd10Descriptions[j]?.trim() || '';
        const ctx = getNarrativeContext(code);
        const ctxStr = ctx
          ? `\n    Narrative map (for this ICD): deficit — ${ctx.deficitDescription}; skill — ${ctx.skillTargeted}; academic impact — ${ctx.academicImpact}`
          : '\n    (No narrative map entry for this ICD — use the code label and goal text.)';
        return `    - ${code}${desc ? ` — ${desc}` : ''}${ctxStr}`;
      });
      const icdBlock =
        icdLines.length > 0
          ? icdLines.join('\n')
          : '    - (No domain-mapped ICD for this goal — use ENCOUNTER ICD-10 list and session notes.)';
      return `ADDRESSED GOAL ${i + 1}\n  - goalId: ${g.goalId}\n  - IEP goal text: ${g.goalDescription}\n  - Goal domain: ${g.domain ?? '—'}\n  - Billing ICD-10 for this goal:\n${icdBlock}`;
    })
    .join('\n\n');
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

function buildSoapSessionsBlock(
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): string {
  const parts: string[] = [];
  for (const s of sessions) {
    const lateLine = s.isLateEntry
      ? 'LATE ENTRY — Note written after date of service'
      : '(not a late entry — omit late-entry line from header)';
    const prior =
      s.priorSessionAccuracyPct != null
        ? `${s.priorSessionAccuracyPct}%`
        : 'Not available — omit prior-session comparison or state no prior data.';

    const endIso = (s.endTime || '').trim() || s.startTime;
    const sessionTimeCentral = `${formatClockMn(s.startTime)} – ${formatClockMn(endIso)}`;

    const encounterIcd = (s.icd10Codes || []).length > 0 ? s.icd10Codes.join(', ') : '—';

    const diagnosisSection =
      s.addressedGoalsWithIcd && s.addressedGoalsWithIcd.length > 0
        ? `
ADDRESSED IEP GOALS WITH DOMAIN-MAPPED ICD-10 (each goal has its billing ICD(s) from the goal's domain. Pair clinical activities and trial lines with the correct goal and ICD; you may reference **more than one** ICD-10 in the prose when multiple goals below were clearly addressed):
${formatAddressedGoalsForPrompt(s.addressedGoalsWithIcd)}`
        : s.narrativeContext
          ? `
DIAGNOSIS CONTEXT (weave briefly into the description prose where relevant — not a SOAP section):
- Deficit Description: ${s.narrativeContext.deficitDescription}
- Skill Targeted: ${s.narrativeContext.skillTargeted}
- Academic Impact: ${s.narrativeContext.academicImpact}
- Medical Necessity (one short clause max if needed): ${s.narrativeContext.medicalNecessityRationale}`
          : `
DIAGNOSIS CONTEXT: No structured narrative map for ICD-10 ${s.primaryIcdCode || '—'}. Use the ICD-10 label/description in SESSION DATA and named goal domains; do not invent unsupported diagnoses.`;

    const ctxBlock = `
- Session context (visit type / timing): ${(s.billingSessionContext || '').trim() || 'Not specified — infer only if clearly supported by session notes'}
- Communication modality (for description): ${(s.communicationModalityBilling || '').trim() || 'Not specified — infer only if clearly supported by session notes (e.g. verbal, Zoom chat, AAC)'}
- Clinical activities (brief): ${(s.clinicalActivitiesBilling || '').trim() || 'Not specified — infer only if supported by session notes'}`;

    const multiPerf = s.performanceSummary.length > 1;
    const trialDataRule = multiPerf
      ? `Performance data are listed **per IEP goal** below. State accuracy and trial counts **per goal** as shown; align each with the matching goalId and ICD block above. Overall prompting tone for the encounter: ${s.promptingLevel}.`
      : s.trialsTotal > 0
        ? `Discrete trials were collected (${s.trialsCorrect}/${s.trialsTotal} trials; ${s.trialAccuracyPct}% accuracy). State results factually with prompting level ${s.promptingLevel}.`
        : `No discrete trial totals this session (trials total 0). The MA description must NOT say "0/0 trials" or "0 trials" or list 0/0 — use qualitative language (e.g. "formal data collection not initiated", "qualitative baseline observation completed") consistent with session notes and clinical judgment.`;

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
- All ICD-10 codes on encounter (fixed): ${encounterIcd}
- Lead summary ICD (first addressed goal when listed; else first encounter code): ${s.primaryIcdCode || '—'} — ${s.primaryIcdDescription || '—'}
- Session Time (Central / America/Chicago): ${sessionTimeCentral} (${s.totalMinutes} minutes)
${s.shortSessionBillingNote ? `- ${s.shortSessionBillingNote}\n` : ''}- Units Billed: ${s.units} (8-minute rule / 15-min units)
- Setting: ${s.modality}
- Goal domain (lead / first addressed goal when listed): ${s.goalDomain || s.domain || 'communication'}
- IEP Goal Targeted (lead): ${s.iepGoalText}
- Performance by IEP goal (discrete trials when recorded):
${formatPerformanceByGoal(s.performanceSummary)}
- Prior Session Accuracy (if available; applies to lead goal row): ${prior}
- Clinician Prompting Level Used: ${s.promptingLevel} (use maximal / moderate / minimal / independent language consistent with this in the description)
- ${trialDataRule}
- Session / clinician notes (verbatim context): ${(s.sessionNotes || '').trim() || 'None recorded'}${diagnosisSection}
${ctxBlock}

CPT / service format (one short clause in description if needed; do not paste verbatim legal boilerplate):
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
 * Full MA billing **description** prompt (one or more sessions). Shared with Gemini and Anthropic.
 * The JSON "note" is pasted into the MA description field — not a full SOAP note.
 */
export function buildSoapGenerationPrompt(
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): string {
  const dataBlock = buildSoapSessionsBlock(sessions, provider);
  return `You are an MS CCC-SLP documenting Minnesota Medicaid (MA) school-based services for a licensed school SLP delivering teletherapy (Zoom) at a K–8 charter school. The billing system uses **discrete fields**; the JSON field **"note"** is the **only narrative** — it is pasted into the **MA clinical description** field. It must **not** be a SOAP note: **no** S– / O– / A– / P– headings, no SOAP template, no multi-page prose.

GOAL: Produce a **defensible, concise, clinically accurate** description (skilled SLP services) without over-documentation. **3–5 sentences. 60–120 words maximum** for the description portion (excluding the optional late-entry header line below).

LATE ENTRY (header line only when applicable):
- If SESSION DATA says the session is a late entry, the "note" value MUST begin with **exactly one first line**: \`LATE ENTRY — Note written after date of service\` (verbatim — no date on this line).
- Then one blank line, then the description sentences.
- If not a late entry, **no** late-entry line — start directly with the description.

DESCRIPTION BODY — cover these in order as natural sentences (merge; do not use bullet labels in output):
1. **Service statement:** CPT code, **all relevant ICD-10 codes** from SESSION DATA when multiple goals were addressed (see ADDRESSED GOALS block), **specific goal domains** (e.g. expressive language, pragmatics, grammar — **never** use the phrase "communication goals per IEP"), individual vs group, teletherapy/Zoom as in SESSION DATA.
2. **Student-specific context:** communication modality of participation (name explicitly when known — e.g. Zoom chat, verbal, AAC); relevant visit context from SESSION DATA or optional fields (first session, post-break, re-evaluation, post-absence, etc.) **only if supported**.
3. **Clinical activity:** what the clinician did; tasks/stimuli briefly; align with **prompting / cueing level** from SESSION DATA (maximal / moderate / minimal / independent).
4. **Data:** If trials are listed per goal, summarize factually **per goal** with the correct ICD for that goal when multiple ICDs apply. If no discrete trials, **never** write "0/0 trials", "0 trials", or similar — use qualitative phrasing consistent with session notes and clinical judgment.
5. **Optional fifth sentence:** brief skilled-service or session-structure justification **only if** the session was data-light or atypical; avoid repetitive boilerplate and walls of medical-necessity text.

RULES:
- ICD-10 and CPT in SESSION DATA are **fixed** — use only ICD-10 codes listed for each addressed goal or on the encounter list; do not invent codes, modalities, or context not supported by SESSION DATA and optional fields.
- When **ADDRESSED IEP GOALS WITH DOMAIN-MAPPED ICD-10** lists more than one goal, the description may reference **more than one** ICD-10; tie each substantive intervention or trial result to the **goal and ICD** it belongs to.
- **Prior session accuracy:** reference only when provided in SESSION DATA; otherwise do not claim comparisons.
- **Provider:** do not include provider signature block or NPI in this description field unless SESSION DATA explicitly asks for a single closing clause (default: omit provider block entirely from "note").

Return a single JSON array only (root = array).
Each element: { "sessionId": "<exact SESSION ID from SESSION DATA>", "note": "<late-entry header if applicable per rules, then description as specified>" }.
Use each SESSION ID verbatim from the SESSION DATA blocks. Do not rename or invent ids.

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
  const addrGoals = (bodySession.goalsAddressedText || []).map((x) => x.trim()).filter(Boolean).slice(0, 4).join('; ');
  const addressed = bodySession.addressedGoalsWithIcd;

  const iepGoalText =
    (addressed && addressed.length > 0 && addressed[0].goalDescription?.trim()) ||
    goalMeta?.description?.trim() ||
    trial.iepGoalText ||
    addrGoals ||
    'IEP communication targets per session export';
  const goalDomain =
    (addressed && addressed.length > 0 && addressed[0].domain?.trim()) ||
    goalMeta?.domain ||
    bodySession.domain ||
    'communication';

  let primaryIcdCode = '';
  let primaryIcdDescription = '';
  let narrativeContext: Icd10NarrativeContext | null = null;

  if (addressed && addressed.length > 0) {
    const first = addressed[0];
    primaryIcdCode = first.icd10Codes[0] || bodySession.icd10Codes[0] || '';
    primaryIcdDescription = first.icd10Descriptions[0] || bodySession.icd10Descriptions[0] || '';
    if (addressed.length === 1) {
      narrativeContext = getNarrativeContext(primaryIcdCode);
    }
  } else {
    primaryIcdCode = bodySession.icd10Codes[0] || '';
    primaryIcdDescription = bodySession.icd10Descriptions[0] || '';
    narrativeContext = getNarrativeContext(primaryIcdCode);
  }

  const cptJustification = cptMedicalNecessityLine(bodySession.cptCode, modality);
  if (primaryIcdCode && !narrativeContext && (!addressed || addressed.length <= 1)) {
    logger.warn(
      { primaryIcdCode, sessionId: bodySession.id },
      'ICD-10 code has no narrative map entry; MA description prompt uses generic diagnosis guidance — add to icd10NarrativeMap if needed'
    );
  }
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
  const d = (domain || '').trim() || 'speech and language';
  const icd = (opts?.icd10Code || '').trim();
  const cpt = (opts?.cptCode || '92507').trim();
  const ctx = icd ? getNarrativeContext(icd) : null;
  const diag = ctx?.diagnosisLabel || (icd ? `ICD-10 ${icd}` : 'documented communication needs');
  const modalityStr = cpt === '92508' ? 'Group teletherapy (Zoom)' : 'Individual teletherapy (Zoom)';
  const goalPhrase = d.toLowerCase().includes('communication') ? d : `${d} communication targets`;
  return `Provided ${modalityStr} (${cpt}) addressing ${diag} with work on ${goalPhrase} per IEP. Structured trial data were not available from the export used for this placeholder; describe participation using qualitative language from the session log when charting. Continue skilled speech-language services per IEP; confirm codes and units against the encounter record.`;
}
