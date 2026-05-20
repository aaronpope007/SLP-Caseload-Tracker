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
  startTime?: string | null;
  endTime?: string | null;
  additionalContext?: string;
}

export function buildEvalMaNotePrompt(input: EvalMaNotePromptInput): string {
  const context = (input.additionalContext || '').trim();
  const contextLine = context
    ? `Additional context (may include multiple date/time blocks): ${context}`
    : 'Additional context: none';

  const sessionTimes = [
    input.startTime?.trim() ? `- Session start (ISO): ${input.startTime.trim()}` : null,
    input.endTime?.trim() ? `- Session end (ISO): ${input.endTime.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Generate MA billing log text for a speech-language evaluation.

Output ONLY formatted time block(s) and one factual action line per block. No preamble, no explanation, no extra sentences, no headers, no paragraph prose, no clinical narrative.

Required format for EACH entry (exactly two lines per entry):
MM/DD/YYYY HH:MM am – HH:MM am
[One simple factual sentence]

Time formatting rules:
- Date as MM/DD/YYYY
- Times as HH:MM am or HH:MM pm (lowercase am/pm, no seconds)
- Use an en-dash (–) between start and end on the time line
- Separate multiple entries with a single blank line

How many entries:
- One session with one time block: generate ONE entry.
- If additional context lists multiple dates/times: generate ONE entry per block.

Action line (pick the best fit):
- Assessment administration: Administered assessment. Scored [test name].
- Report writing/documentation: Scored and interpreted results. Completed report, see evaluation report dated [date].
- If unclear: Administered and scored [assessment title].
Use [test name] or [assessment title] from the assessment title below. For the report line, [date] is the session date as MM/DD/YYYY.

Session details:
- Student: ${input.studentName}
- Session date: ${input.date}
- Assessment title: ${input.title}
- Evaluation type: ${input.category || 'Evaluation'}
${sessionTimes ? `${sessionTimes}\n` : ''}${contextLine}

Output ONLY the formatted time block(s) as plain text.`;
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
