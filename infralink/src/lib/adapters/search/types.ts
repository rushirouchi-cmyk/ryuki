/** Web Search Provider 抽象 (§39)。Market Research Agent はこれだけに依存する。 */

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  /** §14 の情報源分類。 */
  sourceType: 'official_career' | 'official_news' | 'job_board' | 'agent_media' | 'news' | 'other';
  publishedAt?: string | null;
  /**
   * 求人の勤務地。検索結果から確実に読み取れた場合のみ設定する。
   * 不明な場合は null のままにし、候補者の希望勤務地で代用してはならない
   * (企業情報として誤った所在地が保存されるため)。
   */
  location?: string | null;
};

export type SearchQuery = {
  /** 匿名化済みプロフィール由来のキーワードのみを渡す (§21)。 */
  keywords: string[];
  location?: string;
  limit?: number;
};

export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchResult[]>;
}

/** §14 の優先順位。小さいほど信頼度が高い。 */
export const SOURCE_TYPE_PRIORITY: Record<SearchResult['sourceType'], number> = {
  official_career: 1,
  official_news: 2,
  job_board: 3,
  agent_media: 4,
  news: 5,
  other: 6,
};

export function classifySource(url: string): SearchResult['sourceType'] {
  const u = url.toLowerCase();
  if (/(recruit|careers?|saiyo|jobs)\./.test(u) || /\/(recruit|careers?|saiyo)\b/.test(u)) {
    return 'official_career';
  }
  if (/(news|press|ir)\b/.test(u)) return 'official_news';
  if (/(rikunabi|mynavi|doda|en-japan|indeed|type\.jp|green-japan)/.test(u)) return 'job_board';
  if (/(bizreach|wantedly|linkedin|levtech)/.test(u)) return 'agent_media';
  return 'other';
}
