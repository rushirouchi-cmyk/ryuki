/**
 * LLM Provider 抽象 (§40)。
 * アプリケーションロジックは AiProvider だけに依存し、
 * Claude / OpenAI / Gemini の差異はここより下に閉じ込める。
 */

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiCompletionOptions = {
  /** JSON のみを返させたい場合に true。プロバイダごとに適切な指示を付与する。 */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type AiCompletion = {
  text: string;
  provider: string;
  model: string;
  /** モックや失敗時のフォールバックで生成されたか。 */
  degraded: boolean;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletion>;
}
