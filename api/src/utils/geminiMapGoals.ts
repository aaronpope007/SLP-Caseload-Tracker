import { GoogleGenerativeAI } from '@google/generative-ai';

const APPROVED_CPT = new Set(['92507', '92508', '92521', '92522', '92523', '92524']);

export function validateCptIndividual(code: string | undefined): string {
  const t = (code || '').trim();
  return APPROVED_CPT.has(t) ? t : '92507';
}

export function validateCptGroup(code: string | undefined): string {
  const t = (code || '').trim();
  return APPROVED_CPT.has(t) ? t : '92508';
}

async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
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

export interface GoalMappingInput {
  goalId: string;
  goalText: string;
}

export interface GoalMappingResult {
  goalId: string;
  goalText: string;
  domain: string;
  icd10Codes: string[];
  icd10Descriptions: string[];
  cptCodeIndividual: string;
  cptCodeGroup: string;
  rationale: string;
}

/**
 * Calls Gemini (preferring a Flash model) to suggest ICD-10 and CPT codes per goal.
 */
export async function mapGoalsWithGemini(
  apiKey: string,
  goals: GoalMappingInput[]
): Promise<GoalMappingResult[]> {
  if (!apiKey) {
    throw new Error('Gemini API key is required (set GEMINI_API_KEY or pass apiKey in the request body)');
  }
  if (goals.length === 0) {
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

  const goalsJson = JSON.stringify(
    goals.map((g) => ({ goalId: g.goalId, goalText: g.goalText })),
    null,
    2
  );

  const prompt = `You are an expert pediatric school-based speech-language pathologist billing assistant for US Medicaid / private insurance.

For each treatment goal below, propose appropriate ICD-10 diagnosis codes and CPT treatment codes for speech-language pathology services.

Approved CPT codes you may use (only these): 92507 (individual treatment), 92508 (group treatment, 2+ students), 92521 (fluency evaluation), 92522 (speech sound production evaluation), 92523 (speech and language evaluation combined, or language evaluation), 92524 (voice/resonance evaluation).

Goals as JSON:
${goalsJson}

Return JSON ONLY: a single array. Each element must have:
- goalId: string (must match input)
- domain: string (short clinical domain label, e.g. "Articulation", "Receptive Language")
- icd10Codes: string[] (valid ICD-10-CM codes, no descriptions inside this array)
- icd10Descriptions: string[] (parallel short descriptions for each code; same length as icd10Codes)
- cptCodeIndividual: string (for one-on-one treatment — usually 92507 unless evaluation)
- cptCodeGroup: string (for group treatment — usually 92508 unless evaluation)
- rationale: string (one or two sentences, plain language)

Use 92507 and 92508 for ongoing treatment goals. Use evaluation CPT codes only when the goal clearly reflects evaluation activities (not typical IEP therapy goals).

Do not include markdown, prose, or keys other than those listed.`;

  let lastErr: Error | null = null;
  for (const name of [modelName, ...available.filter((m) => m !== modelName)].slice(0, 6)) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent(prompt);
      const text = (await result.response).text();
      const parsed = extractJsonArray(text);
      if (!Array.isArray(parsed)) {
        throw new Error('Model did not return a JSON array');
      }

      const byId = new Map(goals.map((g) => [g.goalId, g]));
      const out: GoalMappingResult[] = [];

      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const goalId = typeof r.goalId === 'string' ? r.goalId : '';
        if (!goalId || !byId.has(goalId)) continue;

        const icd10Codes = Array.isArray(r.icd10Codes)
          ? r.icd10Codes.filter((c): c is string => typeof c === 'string')
          : [];
        const icd10Descriptions = Array.isArray(r.icd10Descriptions)
          ? r.icd10Descriptions.filter((c): c is string => typeof c === 'string')
          : [];

        const cptCodeIndividual = validateCptIndividual(
          typeof r.cptCodeIndividual === 'string' ? r.cptCodeIndividual : undefined
        );
        const cptCodeGroup = validateCptGroup(
          typeof r.cptCodeGroup === 'string' ? r.cptCodeGroup : undefined
        );

        out.push({
          goalId,
          goalText: byId.get(goalId)!.goalText,
          domain: typeof r.domain === 'string' ? r.domain : '',
          icd10Codes,
          icd10Descriptions,
          cptCodeIndividual,
          cptCodeGroup,
          rationale: typeof r.rationale === 'string' ? r.rationale : '',
        });
      }

      if (out.length === 0) {
        throw new Error('Parsed array contained no valid goal mappings');
      }
      const byOutId = new Set(out.map((x) => x.goalId));
      for (const g of goals) {
        if (!byOutId.has(g.goalId)) {
          out.push({
            goalId: g.goalId,
            goalText: g.goalText,
            domain: '',
            icd10Codes: [],
            icd10Descriptions: [],
            cptCodeIndividual: validateCptIndividual(undefined),
            cptCodeGroup: validateCptGroup(undefined),
            rationale: 'No mapping returned for this goal; defaulted CPT. Review and edit manually.',
          });
        }
      }
      return out;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr || new Error('Gemini goal mapping failed');
}
