import { getAiProvider, safeJsonParse } from '@/lib/adapters/ai';
import { CA_RESPONSE_CHOICES } from '@/lib/domain/enums';
import { addBusinessDays, parseDate } from '@/lib/domain/dates';

/**
 * CA 回答の構造化 (§8)。
 *
 * 選択肢だけでなく自由記述にも対応する。
 * LLM が使えない場合でも運用が止まらないよう、まずルールベースで解釈し、
 * LLM が利用可能なときはその結果で上書きする。
 */

export type CaResponseStructured = {
  status: string;
  statusLabel: string;
  lastContactDate: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  memo: string;
  confidence: 'High' | 'Medium' | 'Low';
  source: 'rule' | 'ai';
};

const STATUS_KEYWORDS: { status: string; patterns: RegExp[] }[] = [
  { status: 'waiting_candidate', patterns: [/返信待ち/, /返事待ち/, /連絡待ち/, /反応がな/] },
  { status: 'considering_jobs', patterns: [/検討中/, /求人を見て/, /比較中/] },
  { status: 'contacted', patterns: [/連絡(済|しました|した)/, /電話(しました|した)/, /面談(しました|した)/, /メール(しました|送)/] },
  { status: 'will_contact', patterns: [/連絡予定/, /再度電話/, /かけ直/, /明日.*電話/, /後ほど/, /改めて/] },
  { status: 'declined_process', patterns: [/辞退/, /お断り/] },
  { status: 'paused', patterns: [/休止/, /一旦(保留|ストップ)/, /転職活動を(止|やめ)/] },
];

const RELATIVE_DAYS: { pattern: RegExp; days: number }[] = [
  { pattern: /本日|今日/, days: 0 },
  { pattern: /明日/, days: 1 },
  { pattern: /明後日/, days: 2 },
  { pattern: /来週/, days: 7 },
  { pattern: /再来週/, days: 14 },
];

const NEXT_ACTION_KEYWORDS: { pattern: RegExp; action: string }[] = [
  { pattern: /電話/, action: '架電' },
  { pattern: /メール/, action: 'メール送信' },
  { pattern: /面談/, action: '面談実施' },
  { pattern: /求人.*(提案|送)/, action: '求人提案' },
  { pattern: /推薦/, action: '企業推薦' },
  { pattern: /面接対策/, action: '面接対策' },
  { pattern: /条件|オファー/, action: '条件確認' },
];

/** ルールベースの解釈。LLM 不在でも必ず何かを返す。 */
export function parseCaResponseByRule(text: string, choiceId?: string): CaResponseStructured {
  const trimmed = text.trim();
  const now = new Date();

  let status = choiceId ?? 'other';
  if (!choiceId) {
    for (const entry of STATUS_KEYWORDS) {
      if (entry.patterns.some((p) => p.test(trimmed))) {
        status = entry.status;
        break;
      }
    }
  }

  // 「電話しました」等の過去形があれば本日を最終接触日とみなす。
  const contactedToday = /(しました|した|済)/.test(trimmed) && /(電話|連絡|メール|面談)/.test(trimmed);
  const lastContactDate = contactedToday ? now.toISOString() : null;

  // 次回アクション日
  let nextActionDate: string | null = null;
  const explicit = trimmed.match(/(\d{1,2})[\/月](\d{1,2})/);
  if (explicit) {
    const date = new Date(now.getFullYear(), Number(explicit[1]) - 1, Number(explicit[2]), 10, 0, 0);
    // 過去日付なら翌年と解釈する。
    if (date < now) date.setFullYear(date.getFullYear() + 1);
    nextActionDate = date.toISOString();
  } else {
    for (const rel of RELATIVE_DAYS) {
      if (rel.pattern.test(trimmed)) {
        const date = new Date(now);
        date.setDate(date.getDate() + rel.days);
        date.setHours(10, 0, 0, 0);
        nextActionDate = date.toISOString();
        break;
      }
    }
  }

  let nextAction: string | null = null;
  for (const entry of NEXT_ACTION_KEYWORDS) {
    if (entry.pattern.test(trimmed)) {
      nextAction = entry.action;
      break;
    }
  }

  // 選択肢由来で日付が読み取れない場合の既定値。放置を防ぐため必ず期日を置く (§6 保留の原則)。
  if (!nextActionDate && ['waiting_candidate', 'considering_jobs', 'will_contact'].includes(status)) {
    nextActionDate = addBusinessDays(now, 2).toISOString();
    nextAction = nextAction ?? '状況再確認';
  }

  const label = CA_RESPONSE_CHOICES.find((c) => c.id === status)?.label ?? 'その他';
  const confidence: CaResponseStructured['confidence'] =
    choiceId && nextActionDate ? 'High' : nextActionDate || nextAction ? 'Medium' : 'Low';

  return {
    status,
    statusLabel: label,
    lastContactDate,
    nextAction,
    nextActionDate,
    memo: trimmed,
    confidence,
    source: 'rule',
  };
}

/** LLM を使った構造化。失敗時はルールベース結果をそのまま返す。 */
export async function parseCaResponse(text: string, choiceId?: string): Promise<CaResponseStructured> {
  const base = parseCaResponseByRule(text, choiceId);
  const provider = getAiProvider();
  if (provider.name === 'mock') return base;

  const prompt = [
    '人材紹介会社のキャリアアドバイザー(CA)による、候補者対応状況の回答を構造化してください。',
    '',
    `本日: ${new Date().toISOString()}`,
    `選択された選択肢: ${choiceId ?? 'なし'}`,
    `回答本文: ${text}`,
    '',
    '次の JSON だけを出力してください。',
    JSON.stringify(
      {
        status: `${CA_RESPONSE_CHOICES.map((c) => c.id).join(' | ')}`,
        last_contact_date: 'ISO8601 または null',
        next_action: '次に行う具体的なアクション、または null',
        next_action_date: 'ISO8601 または null',
        memo: '要約メモ',
        confidence: 'High | Medium | Low',
      },
      null,
      2,
    ),
  ].join('\n');

  const completion = await provider.complete(
    [
      { role: 'system', content: '日本の人材紹介業務に精通したアシスタントです。推測で日付を作らず、不明なら null にしてください。' },
      { role: 'user', content: prompt },
    ],
    { json: true },
  );
  if (completion.degraded) return base;

  const parsed = safeJsonParse<{
    status?: string;
    last_contact_date?: string | null;
    next_action?: string | null;
    next_action_date?: string | null;
    memo?: string;
    confidence?: string;
  }>(completion.text);
  if (!parsed) return base;

  const status = CA_RESPONSE_CHOICES.some((c) => c.id === parsed.status) ? parsed.status! : base.status;
  return {
    status,
    statusLabel: CA_RESPONSE_CHOICES.find((c) => c.id === status)?.label ?? 'その他',
    lastContactDate: parseDate(parsed.last_contact_date ?? null)?.toISOString() ?? base.lastContactDate,
    nextAction: parsed.next_action ?? base.nextAction,
    nextActionDate: parseDate(parsed.next_action_date ?? null)?.toISOString() ?? base.nextActionDate,
    memo: parsed.memo ?? base.memo,
    confidence: (['High', 'Medium', 'Low'].includes(parsed.confidence ?? '')
      ? parsed.confidence
      : base.confidence) as CaResponseStructured['confidence'],
    source: 'ai',
  };
}
