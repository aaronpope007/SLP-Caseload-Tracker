import { logError, logInfo } from './logger';

export const ANTHROPIC_API_KEY_STORAGE_KEY = 'anthropic_api_key';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/** Models to try in order (newer first); fall back on 404. */
const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022',
] as const;

export function getHttpStatusFromError(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  const msg = error instanceof Error ? error.message : String(error);
  const bracket = msg.match(/\[\s*(\d{3})\s*\]/);
  if (bracket) return parseInt(bracket[1], 10);
  return undefined;
}

/**
 * True when Gemini failed for capacity/rate-limit style reasons — reasonable to try Claude next.
 */
export function isGeminiRetryableOrOverloadError(error: unknown): boolean {
  const status = getHttpStatusFromError(error);
  if (status === 401 || status === 403) return false;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('try again later') ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('network error') ||
    msg.includes('failed to fetch')
  );
}

type AnthropicMessageResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { type?: string; message?: string };
};

/**
 * Single completion via Anthropic Messages API. Uses browser CORS (BYOK) per Anthropic docs.
 */
export async function generateTextWithClaude(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error('Anthropic API key is required');
  }

  let lastError: Error | null = null;

  for (const model of CLAUDE_MODELS) {
    try {
      const res = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = (await res.json()) as AnthropicMessageResponse;

      if (!res.ok) {
        const errMsg = data.error?.message || res.statusText || `HTTP ${res.status}`;
        const err = new Error(errMsg) as Error & { status?: number };
        err.status = res.status;
        lastError = err;
        if (res.status === 404) {
          if (import.meta.env.DEV) {
            logInfo(`Claude model not found, trying next: ${model}`);
          }
          continue;
        }
        throw err;
      }

      const text = data.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
        .trim();

      if (!text) {
        throw new Error('Empty response from Claude');
      }
      return text;
    } catch (e: unknown) {
      const status = getHttpStatusFromError(e);
      if (status === 404) {
        continue;
      }
      lastError = e instanceof Error ? e : new Error(String(e));
      logError(`Claude request failed (${model})`, e);
      throw lastError;
    }
  }

  throw lastError || new Error('No available Claude models responded');
}
