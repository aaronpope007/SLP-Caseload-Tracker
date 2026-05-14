import { GoogleGenerativeAI } from '@google/generative-ai';
import { cptDescriptionForPrompt } from './cptDescriptions';
import { calcUnits, sessionDurationMinutes } from './billingUnits';

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
}

export interface SoapNoteProviderInfo {
  providerName: string;
  credentials: string;
  npiNumber: string;
}

function formatYmdInTz(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

function serviceYmdFromIso(sessionDateIso: string): string {
  const d = new Date(sessionDateIso);
  if (Number.isNaN(d.getTime())) return sessionDateIso.slice(0, 10);
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

    const block = `
SESSION ID: ${s.id}
- Student: ${s.studentName}, DOB: ${s.studentDob || 'Not on file'}
- Grade: ${s.grade}
- Date of Service: ${formatDisplayDate(s.serviceDateYmd)}
- Late entry: ${lateLine}
- CPT Code: ${s.cptCode} — ${s.cptDescription}
- ICD-10: ${s.primaryIcdCode || '—'} — ${s.primaryIcdDescription || '—'}
- Session Time: ${s.startTime} – ${s.endTime} (${s.totalMinutes} minutes)
${s.shortSessionBillingNote ? `- ${s.shortSessionBillingNote}\n` : ''}- Units Billed: ${s.units} (8-minute rule / 15-min units)
- Setting: ${s.modality}
- Goal domain (for interventions): ${s.goalDomain || s.domain || 'communication'}
- IEP Goal Targeted: ${s.iepGoalText}
- Trial Accuracy This Session: ${s.trialAccuracyPct}% (${s.trialsCorrect}/${s.trialsTotal} trials)
- Prior Session Accuracy (if available): ${prior}
- Clinician Prompting Level Used: ${s.promptingLevel} (derive from session rules; do not contradict)
- Session / clinician notes (verbatim context): ${(s.sessionNotes || '').trim() || 'None recorded'}
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
        .filter((m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest'));
    }
  } catch {
    // ignore
  }
  return [];
}

function pickFlashModel(available: string[]): string {
  const flash = available.find(
    (m) =>
      m.includes('flash') &&
      !m.toLowerCase().includes('thinking') &&
      !m.toLowerCase().includes('lite')
  );
  return flash || available[0] || 'gemini-2.0-flash';
}

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw) as unknown;
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
    available = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
    ];
  }

  const modelName = pickFlashModel(available);
  const genAI = new GoogleGenerativeAI(apiKey);

  const dataBlock = buildSoapSessionsBlock(sessions, provider);

  const prompt = `You are a licensed school-based Speech-Language Pathologist writing Minnesota DHS-compliant SOAP progress notes.
Generate a complete note for EACH session below using ONLY the data provided. Do not fabricate medical facts, diagnoses, or outcomes not supported by the data. Use professional clinical language.

For each session, follow this exact output structure (plain text inside the JSON "note" string, with line breaks as shown):

STUDENT: [name] | DOB: [dob] | DATE OF SERVICE: [service date M/D/YYYY]
[If late entry per SESSION DATA, start this line with: LATE ENTRY — DATE NOTE WRITTEN: [today M/D/YYYY] | ]CPT: [code] | ICD-10: [primary code]
SESSION: [start time]–[end time] ([X] min) | UNITS BILLED: [X] | SETTING: [modality from data]

S – SUBJECTIVE
[Student status, transition, engagement, readiness. 2–3 sentences.]

O – OBJECTIVE
IEP Goal Targeted: [goal text from data]
Interventions: [clinician strategies appropriate to goal domain and teletherapy setting]
Data: Student achieved [X]% accuracy ([correct]/[total] trials) with [prompting level] clinician support.

A – ASSESSMENT
[Interpret data vs. prior session when prior accuracy is available; otherwise note limited comparison. Note trend. Affirm medical necessity. 2–3 sentences.]

P – PLAN
Continue speech-language therapy per IEP schedule. Next session will [advance/maintain/modify] targets based on today's performance.

[Provider name], [credentials]
NPI: [NPI from PROVIDER block; if blank write "NPI: Pending configuration"]

Return ONLY a JSON array in this exact format, no markdown fences, no commentary:
[
  { "sessionId": "[id]", "note": "[full multiline note]" },
  ...
]

SESSION DATA (per session separated by ---):
${dataBlock}
`;

  let lastErr: Error | null = null;
  for (const name of [modelName, ...available.filter((m) => m !== modelName)].slice(0, 6)) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        generationConfig: {
          maxOutputTokens: 8000,
        },
      });
      const result = await model.generateContent(prompt);
      const text = (await result.response).text();
      let parsed: unknown;
      try {
        parsed = extractJsonArray(text);
      } catch {
        throw new Error('Failed to parse AI response');
      }
      if (!Array.isArray(parsed)) {
        throw new Error('Failed to parse AI response');
      }

      const out: Array<{ sessionId: string; note: string }> = [];
      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const sessionId = typeof r.sessionId === 'string' ? r.sessionId.trim() : '';
        const note = typeof r.note === 'string' ? r.note.trim() : '';
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
  const serviceDateYmd = serviceYmdFromIso(bodySession.date);
  const noteWrittenYmd = todayYmdChicago();
  const isLateEntry = serviceDateYmd !== noteWrittenYmd;
  const trial = primaryTrialBlock(bodySession);
  const promptingLevel = promptingLevelFromAccuracy(trial.trialAccuracyPct);
  const modality = bodySession.isGroup ? 'Group Teletherapy via Zoom' : 'Individual Teletherapy via Zoom';
  const primaryIcdCode = bodySession.icd10Codes[0] || '';
  const primaryIcdDescription = bodySession.icd10Descriptions[0] || '';
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
    studentDob: studentDob || 'Not on file',
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
  };
}

export function genericSessionNote(domain: string | undefined): string {
  const d = (domain || '').trim() || 'communication';
  const today = formatDisplayDate(todayYmdChicago());
  return `STUDENT: Student | DOB: Not on file | DATE OF SERVICE: ${today}
CPT: 92507 | ICD-10: —
SESSION: — (0 min) | UNITS BILLED: 0 | SETTING: Individual Teletherapy via Zoom

S – SUBJECTIVE
Student participated in a speech-language therapy session as documented.

O – OBJECTIVE
IEP Goal Targeted: ${d} goals per IEP.
Interventions: Activities aligned with teletherapy service delivery.
Data: Session documentation did not include trial-level data in the export used for note generation.

A – ASSESSMENT
Insufficient structured data were available to quantify progress this session; medical necessity for ongoing therapy continues per IEP.

P – PLAN
Continue speech-language therapy per IEP schedule. Next session will maintain targets until quantitative data are available.

Clinician
NPI: Pending configuration`;
}
