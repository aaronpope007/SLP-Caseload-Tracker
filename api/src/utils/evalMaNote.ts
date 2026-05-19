import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

const EVAL_MA_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export interface EvalMaNotePromptInput {
  studentName: string;
  date: string;
  title: string;
  cptCode: string;
  category: string;
  additionalContext?: string;
}

export function buildEvalMaNotePrompt(input: EvalMaNotePromptInput): string {
  const context = (input.additionalContext || '').trim() || 'none provided';
  const cptDisplay = input.cptCode?.trim() || 'not specified';

  return `You are a licensed speech-language pathologist writing a brief MA billing documentation note for a speech-language evaluation.

Write a single paragraph (60–100 words) suitable for MA billing documentation.

Session details:
- Student: ${input.studentName}
- Date: ${input.date}
- Assessment(s) administered: ${input.title}
- CPT code: ${cptDisplay}
- Evaluation type: ${input.category || 'Evaluation'}
- Additional context: ${context}

Rules:
- Do NOT include CPT codes or ICD-10 codes in the note body
- Write in third person, past tense
- Mention the specific assessment(s) administered
- State the purpose (e.g. "to assess speech sound production" or "to evaluate language comprehension and expression")
- Note that results will be used to determine eligibility and guide treatment planning
- Do not include scores or results (those go in the eval report)
- End with one sentence about next steps (e.g. report completion, eligibility determination meeting)

Return only the paragraph text with no headings or bullet points.`;
}

async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
  return (data.models || [])
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((m) => {
      const full = data.models?.find((x) => x.name.replace(/^models\//, '') === m);
      return full?.supportedGenerationMethods?.includes('generateContent');
    });
}

function pickGeminiModel(available: string[]): string {
  const prefer = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
  ];
  for (const p of prefer) {
    const hit = available.find((m) => m === p || m.startsWith(p));
    if (hit) return hit;
  }
  return available[0] || 'gemini-2.0-flash';
}

export async function generateEvalMaNoteWithGemini(apiKey: string, prompt: string): Promise<string> {
  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is required');
  }
  const available = await listGeminiModels(apiKey.trim());
  const modelName = pickGeminiModel(available.length > 0 ? available : ['gemini-2.0-flash']);
  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const text = (await result.response).text().trim();
  if (!text) throw new Error('Gemini returned an empty note');
  return text;
}

export async function generateEvalMaNoteWithAnthropic(apiKey: string, prompt: string): Promise<string> {
  if (!apiKey?.trim()) {
    throw new Error('Anthropic API key is required');
  }
  const client = new Anthropic({ apiKey: apiKey.trim() });
  const response = await client.messages.create({
    model: EVAL_MA_ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();
  if (!text) throw new Error('Anthropic returned an empty note');
  return text;
}

export async function generateEvalMaNote(
  prompt: string,
  geminiKey: string,
  anthropicKey: string
): Promise<string> {
  if (geminiKey?.trim()) {
    try {
      return await generateEvalMaNoteWithGemini(geminiKey, prompt);
    } catch (err) {
      logger.warn({ err }, 'Gemini eval MA note generation failed; attempting Anthropic fallback');
      if (!anthropicKey?.trim()) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg || 'AI generation failed');
      }
    }
  }
  if (anthropicKey?.trim()) {
    return generateEvalMaNoteWithAnthropic(anthropicKey, prompt);
  }
  throw new Error(
    'No AI API key configured. Add a Gemini key and/or Anthropic key in Settings, or set GEMINI_API_KEY and/or ANTHROPIC_API_KEY on the server.'
  );
}
