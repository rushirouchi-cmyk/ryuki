import type { AiProvider } from './types';
import { MockAiProvider } from './mock';
import { AnthropicProvider, GeminiProvider, OpenAiProvider } from './http';

export * from './types';

let cached: AiProvider | null = null;

/**
 * 環境変数から AI Provider を解決する (§40/§41)。
 * キーが無い場合は自動的に Mock へ落とし、開発を止めない (§42)。
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const kind = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
  const model = process.env.AI_MODEL ?? '';

  if (kind === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider(model || 'claude-sonnet-5', process.env.ANTHROPIC_API_KEY);
  } else if (kind === 'openai' && process.env.OPENAI_API_KEY) {
    cached = new OpenAiProvider(model || 'gpt-4o-mini', process.env.OPENAI_API_KEY);
  } else if (kind === 'gemini' && process.env.GEMINI_API_KEY) {
    cached = new GeminiProvider(model || 'gemini-2.0-flash', process.env.GEMINI_API_KEY);
  } else {
    cached = new MockAiProvider();
  }
  return cached;
}

/** テスト用にキャッシュを破棄する。 */
export function resetAiProvider() {
  cached = null;
}

/** JSON を返させたい場合のヘルパー。パース失敗時は null。 */
export function safeJsonParse<T>(text: string): T | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
