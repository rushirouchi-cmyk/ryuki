import type { AiCompletion, AiCompletionOptions, AiMessage, AiProvider } from './types';

/**
 * API キーが無い状態でもシステム全体を動かすための Mock Provider (§42)。
 * LLM を呼ばず、決定的なルールベースで妥当な JSON / 文章を返す。
 * 呼び出し側は degraded=true を見て「AI 生成ではない」ことを UI に出せる。
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly model = 'rule-based';

  async complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletion> {
    const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    const text = options?.json ? this.jsonFallback(last) : this.textFallback(last);
    return { text, provider: this.name, model: this.model, degraded: true };
  }

  private jsonFallback(prompt: string): string {
    // 呼び出し側が期待する形をプロンプト内のヒントから判別する。
    if (prompt.includes('"rejection_tag"')) {
      return JSON.stringify({ rejection_tag: 'other', confidence: 'Low', rationale: 'モック応答' });
    }
    if (prompt.includes('"status"') && prompt.includes('"next_action"')) {
      return JSON.stringify({
        status: 'contacted',
        last_contact_date: null,
        next_action: null,
        next_action_date: null,
        memo: prompt.slice(0, 200),
        confidence: 'Low',
      });
    }
    return JSON.stringify({ result: null, confidence: 'Low', note: 'MockAiProvider' });
  }

  private textFallback(prompt: string): string {
    return [
      '（モック応答: AI_PROVIDER=mock のため LLM は呼び出されていません）',
      prompt.slice(0, 400),
    ].join('\n');
  }
}
