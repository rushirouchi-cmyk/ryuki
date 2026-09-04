import { getAiProvider, safeJsonParse } from '@/lib/adapters/ai';
import { REJECTION_TAGS, REJECTION_TAG_LABELS, type RejectionTag } from '@/lib/domain/enums';

/**
 * 見送り理由の構造化 (§34)。
 *
 * 企業からの原文 (rejection_reason_original) は絶対に消さず、
 * AI はタグ候補を「提案」するだけ。確定は人が行う (§51)。
 */

const RULES: { tag: RejectionTag; patterns: RegExp[] }[] = [
  { tag: 'experience_shortage', patterns: [/経験(年数)?が?(やや)?(不足|浅|足りな)/, /実務経験.*(不足|届か)/] },
  { tag: 'industry_experience', patterns: [/業界(経験|未経験)/] },
  { tag: 'job_experience', patterns: [/職種(経験|未経験)/, /(設計|保全|施工管理).*の(実務)?経験が/] },
  { tag: 'qualification', patterns: [/資格/, /免許/] },
  { tag: 'age', patterns: [/年齢/, /年代/] },
  { tag: 'job_change_count', patterns: [/転職回数/, /在籍期間が短/] },
  { tag: 'salary', patterns: [/年収/, /給与/, /条件面/] },
  { tag: 'location', patterns: [/勤務地/, /通勤/, /転勤/] },
  { tag: 'education', patterns: [/学歴/, /大学/] },
  { tag: 'communication', patterns: [/コミュニケーション/, /説明が/, /受け答え/] },
  { tag: 'motivation', patterns: [/志望(動機|度)/, /入社意欲/] },
  { tag: 'career_orientation', patterns: [/キャリア(志向|観)/, /将来像/] },
  { tag: 'culture_fit', patterns: [/社風/, /カルチャー/, /適応/, /馴染/] },
  { tag: 'compared_with_others', patterns: [/他(の)?候補者/, /比較検討/, /総合的に判断/] },
];

export type TagSuggestion = {
  tag: RejectionTag;
  label: string;
  confidence: 'High' | 'Medium' | 'Low';
  rationale: string;
  source: 'rule' | 'ai';
};

export function suggestTagByRule(original: string): TagSuggestion {
  for (const rule of RULES) {
    const hit = rule.patterns.find((p) => p.test(original));
    if (hit) {
      return {
        tag: rule.tag,
        label: REJECTION_TAG_LABELS[rule.tag],
        confidence: 'Medium',
        rationale: `原文中の表現「${original.match(hit)?.[0] ?? ''}」に基づく判定`,
        source: 'rule',
      };
    }
  }
  return {
    tag: 'other',
    label: REJECTION_TAG_LABELS.other,
    confidence: 'Low',
    rationale: '既知のパターンに一致せず',
    source: 'rule',
  };
}

export async function suggestRejectionTag(original: string): Promise<TagSuggestion> {
  const rule = suggestTagByRule(original);
  const provider = getAiProvider();
  if (provider.name === 'mock' || !original.trim()) return rule;

  const completion = await provider.complete(
    [
      { role: 'system', content: '人材紹介の選考結果を分類するアシスタントです。原文に無い理由を推測してはいけません。' },
      {
        role: 'user',
        content: [
          '次の「企業からの見送り理由の原文」を、指定のタグ 1 つに分類してください。',
          `タグ候補: ${REJECTION_TAGS.join(', ')}`,
          '',
          `原文: ${original}`,
          '',
          'JSON のみ: {"rejection_tag":"","confidence":"High|Medium|Low","rationale":""}',
        ].join('\n'),
      },
    ],
    { json: true },
  );
  if (completion.degraded) return rule;

  const parsed = safeJsonParse<{ rejection_tag?: string; confidence?: string; rationale?: string }>(
    completion.text,
  );
  const tag = REJECTION_TAGS.find((t) => t === parsed?.rejection_tag);
  if (!parsed || !tag) return rule;

  return {
    tag,
    label: REJECTION_TAG_LABELS[tag],
    confidence: (['High', 'Medium', 'Low'].includes(parsed.confidence ?? '') ? parsed.confidence : 'Medium') as TagSuggestion['confidence'],
    rationale: parsed.rationale ?? '',
    source: 'ai',
  };
}
