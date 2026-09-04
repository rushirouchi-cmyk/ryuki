import { classifySource, type SearchProvider, type SearchQuery, type SearchResult } from './types';

/**
 * SEARCH_API_KEY が無い環境でも Market Research Agent を通しで確認するための Mock (§42)。
 * 決定的な擬似企業を返し、実運用データと混同しないよう URL に example ドメインを使う。
 */
const MOCK_COMPANIES = [
  { name: '関西プロセス工業株式会社', domain: 'kansai-process.example.co.jp', industry: '化学メーカー', location: '大阪府' },
  { name: '日本設備テクノ株式会社', domain: 'nihon-setsubi-techno.example.co.jp', industry: 'プラントエンジニアリング', location: '兵庫県' },
  { name: '西日本エナジーサービス株式会社', domain: 'nishinihon-energy.example.co.jp', industry: 'エネルギー', location: '大阪府' },
  { name: 'ミナミ精密機械株式会社', domain: 'minami-seimitsu.example.co.jp', industry: '機械メーカー', location: '大阪府' },
  { name: '阪神データセンター株式会社', domain: 'hanshin-dc.example.co.jp', industry: 'データセンター', location: '兵庫県' },
  { name: '中央ファシリティ管理株式会社', domain: 'chuo-facility.example.co.jp', industry: 'ファシリティマネジメント', location: '東京都' },
  { name: '東海建設エンジニアリング株式会社', domain: 'tokai-kensetsu-eng.example.co.jp', industry: '建設', location: '愛知県' },
  { name: '北関東マテリアル株式会社', domain: 'kitakanto-material.example.co.jp', industry: '素材メーカー', location: '埼玉県' },
];

/** 文字列から決定的な非負整数を作る (テストの再現性のため乱数は使わない)。 */
function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 100_000;
  return h;
}

export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock';

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const limit = query.limit ?? 8;
    const primary = query.keywords[0] ?? '技術職';

    // 勤務地が一致する企業を優先しつつ、検索語ごとに異なる企業集合が返るようにする。
    // 全候補者に同じ企業が並ぶと新規開拓の優先順位付けが検証できないため、
    // キーワードから決定的なオフセットを作って並びを回転させる。
    const offset = hash(query.keywords.join('|'));
    const ranked = [...MOCK_COMPANIES]
      .sort((a, b) => {
        const aHit = query.location && a.location.includes(query.location.slice(0, 2)) ? 0 : 1;
        const bHit = query.location && b.location.includes(query.location.slice(0, 2)) ? 0 : 1;
        return aHit - bHit || a.name.localeCompare(b.name);
      })
      .map((company, index, all) => all[(index + offset) % all.length]);

    return ranked.slice(0, limit).map((c, i) => {
      const url = `https://${c.domain}/recruit/careers/${encodeURIComponent(primary)}-${i + 1}`;
      return {
        title: `${c.name} ${primary}（${c.location}）`,
        url,
        snippet: [
          `${c.industry}。${c.location}の拠点にて${primary}を募集。`,
          `想定要件: ${query.keywords.slice(0, 4).join(' / ')}`,
          '経験年数5年以上、関連資格保有者歓迎。',
        ].join(' '),
        sourceType: classifySource(url),
        publishedAt: null,
        location: c.location,
      };
    });
  }
}
