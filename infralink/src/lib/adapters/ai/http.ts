import type { AiCompletion, AiCompletionOptions, AiMessage, AiProvider } from './types';
import { MockAiProvider } from './mock';

/** 実 API を叩く Provider 群。障害時は Mock にフォールバックし、業務を止めない (§42)。 */

async function fallback(messages: AiMessage[], options: AiCompletionOptions | undefined) {
  return new MockAiProvider().complete(messages, options);
}

function splitSystem(messages: AiMessage[]) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system, rest };
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  constructor(readonly model: string, private apiKey: string) {}

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletion> {
    const { system, rest } = splitSystem(messages);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options?.maxTokens ?? 2000,
          temperature: options?.temperature ?? 0,
          system: options?.json ? `${system}\n\nJSON のみを出力してください。` : system,
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) return fallback(messages, options);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('');
      if (!text) return fallback(messages, options);
      return { text, provider: this.name, model: this.model, degraded: false };
    } catch {
      return fallback(messages, options);
    }
  }
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  constructor(readonly model: string, private apiKey: string) {}

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletion> {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: options?.temperature ?? 0,
          max_tokens: options?.maxTokens ?? 2000,
          ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
      });
      if (!res.ok) return fallback(messages, options);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? '';
      if (!text) return fallback(messages, options);
      return { text, provider: this.name, model: this.model, degraded: false };
    } catch {
      return fallback(messages, options);
    }
  }
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  constructor(readonly model: string, private apiKey: string) {}

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletion> {
    const { system, rest } = splitSystem(messages);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: rest.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: options?.temperature ?? 0,
            maxOutputTokens: options?.maxTokens ?? 2000,
            ...(options?.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
      if (!res.ok) return fallback(messages, options);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text) return fallback(messages, options);
      return { text, provider: this.name, model: this.model, degraded: false };
    } catch {
      return fallback(messages, options);
    }
  }
}
