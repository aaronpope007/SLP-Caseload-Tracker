import Anthropic from '@anthropic-ai/sdk';
import type { SoapNoteGenerationSession, SoapNoteProviderInfo } from './geminiSessionNotes';
import {
  buildSoapGenerationPrompt,
  parseSessionNotesAiResponse,
  resolveKnownSessionId,
} from './geminiSessionNotes';
import { logger } from './logger';

const SOAP_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

/**
 * Same contract as Gemini: one batched prompt, JSON array of { sessionId, note }.
 * Used when Gemini fails or when no Gemini key is configured but Anthropic is available.
 */
export async function generateSessionNotesWithAnthropic(
  apiKey: string,
  sessions: SoapNoteGenerationSession[],
  provider: SoapNoteProviderInfo
): Promise<Array<{ sessionId: string; note: string }>> {
  if (!apiKey?.trim()) {
    throw new Error('Anthropic API key is required for SOAP note generation');
  }
  if (sessions.length === 0) {
    return [];
  }

  const client = new Anthropic({ apiKey: apiKey.trim() });
  const prompt = buildSoapGenerationPrompt(sessions, provider);
  const knownSessionIds = new Set(sessions.map((s) => s.id));

  let text: string;
  try {
    const response = await client.messages.create({
      model: SOAP_ANTHROPIC_MODEL,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    });
    text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
  } catch (err) {
    logger.error({ err }, 'Anthropic SOAP batch request failed');
    throw err;
  }

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
}
