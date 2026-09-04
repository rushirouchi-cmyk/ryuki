/**
 * 技術スキル・資格・職種のタクソノミ (§10)。
 *
 * 表記ゆれを正規化するための別名辞書を持つ。ここを増やせば
 * ルールベース抽出の精度が上がり、LLM が使えない環境でも劣化しにくい。
 */

export type SkillDef = {
  name: string;
  category: 'technical' | 'equipment' | 'software' | 'domain' | 'management';
  aliases: string[];
};

export const SKILLS: SkillDef[] = [
  { name: 'PLC', category: 'technical', aliases: ['plc', 'シーケンサ', 'シーケンサー', 'ラダー'] },
  { name: 'シーケンス制御', category: 'technical', aliases: ['シーケンス', '制御盤設計', 'ラダー制御'] },
  { name: 'CAD', category: 'software', aliases: ['cad', '2次元cad', '3次元cad'] },
  { name: 'AutoCAD', category: 'software', aliases: ['autocad', 'オートキャド'] },
  { name: '電気設備', category: 'domain', aliases: ['受変電', '受変電設備', '高圧受電', '電気工事', '電源設備'] },
  { name: '機械設備', category: 'domain', aliases: ['回転機', 'ポンプ', '機械保全', '機械設計'] },
  { name: '施工管理', category: 'domain', aliases: ['工事管理', '現場監督', '工程管理'] },
  { name: '設備保全', category: 'domain', aliases: ['保全', 'メンテナンス', '設備管理', '保守'] },
  { name: '予防保全', category: 'technical', aliases: ['tpm', '計画保全', '定期点検'] },
  { name: '故障対応', category: 'technical', aliases: ['トラブル対応', '故障診断', '突発対応'] },
  { name: '設備改善', category: 'technical', aliases: ['改善活動', '省人化', '生産性改善', '省エネ'] },
  { name: '生産設備', category: 'equipment', aliases: ['製造設備', 'ライン設備'] },
  { name: 'プラント', category: 'domain', aliases: ['プラントエンジニアリング', '化学プラント', '石油化学'] },
  { name: 'ロボット', category: 'equipment', aliases: ['産業用ロボット', '協働ロボット', 'ロボットティーチング'] },
  { name: 'ファシリティ', category: 'domain', aliases: ['ビル管理', 'ビルメンテナンス', 'ファシリティマネジメント', '建物管理'] },
  { name: 'データセンター', category: 'domain', aliases: ['dc', 'idc', 'データセンタ'] },
  { name: '生産技術', category: 'domain', aliases: ['工程設計', 'ライン設計', '設備立ち上げ'] },
  { name: '建築設計', category: 'domain', aliases: ['意匠設計', '実施設計', '基本設計'] },
  { name: 'DCS', category: 'technical', aliases: ['dcs', '分散制御'] },
  { name: '危険物取扱', category: 'domain', aliases: ['危険物'] },
];

export const QUALIFICATIONS: { name: string; aliases: string[] }[] = [
  { name: '電験三種', aliases: ['第三種電気主任技術者', '電気主任技術者(三種)', '電験3種'] },
  { name: '電験二種', aliases: ['第二種電気主任技術者', '電験2種'] },
  { name: '第一種電気工事士', aliases: ['1種電気工事士', '第1種電気工事士'] },
  { name: '第二種電気工事士', aliases: ['2種電気工事士', '第2種電気工事士'] },
  { name: '電気工事施工管理技士', aliases: ['1級電気工事施工管理技士', '2級電気工事施工管理技士'] },
  { name: '管工事施工管理技士', aliases: ['1級管工事施工管理技士', '2級管工事施工管理技士'] },
  { name: '建築施工管理技士', aliases: ['1級建築施工管理技士', '2級建築施工管理技士'] },
  { name: '建築士', aliases: ['一級建築士', '二級建築士', '1級建築士', '2級建築士'] },
  { name: 'エネルギー管理士', aliases: ['エネルギー管理員'] },
  { name: '危険物取扱者', aliases: ['危険物取扱者乙4', '乙種第4類'] },
  { name: 'ボイラー技士', aliases: ['1級ボイラー技士', '2級ボイラー技士'] },
  { name: '冷凍機械責任者', aliases: ['高圧ガス製造保安責任者'] },
];

/** 重点職種 (§1)。候補者・求人の職種正規化に使う。 */
export const JOB_CATEGORIES: { name: string; aliases: string[] }[] = [
  { name: '施工管理', aliases: ['現場監督', '工事管理', '工事監理'] },
  { name: 'プラントエンジニア', aliases: ['プラント設計', 'プラント技術', '計装'] },
  { name: 'サービスエンジニア', aliases: ['フィールドエンジニア', 'カスタマーエンジニア', '保守サービス'] },
  { name: '設備保全', aliases: ['保全', '設備管理', '設備保守', 'メンテナンス'] },
  { name: '生産技術', aliases: ['製造技術', '工程設計'] },
  { name: '建築設計', aliases: ['意匠設計', '構造設計'] },
  { name: '電気設備', aliases: ['電気設計', '電気エンジニア'] },
  { name: '機械設備', aliases: ['機械設計', '機械エンジニア'] },
  { name: 'ファシリティマネジメント', aliases: ['ビル管理', 'ファシリティ', 'FM'] },
  { name: 'データセンター', aliases: ['DC 設備', 'DC 運用'] },
];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    // 全角英数を半角へ
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '');
}

function matchAny(haystack: string, candidates: string[]) {
  return candidates.some((c) => haystack.includes(normalizeText(c)));
}

/**
 * 一致した別名のうち最長の文字数を返す (一致しなければ 0)。
 *
 * 「予防保全」は 設備保全 の別名「保全」にも部分一致してしまうため、
 * 単純な先勝ちだと 予防保全 → 設備保全 と誤って丸められる。
 * 正規化では常に最長一致を採用してこれを防ぐ。
 */
function matchStrength(haystack: string, candidates: string[]) {
  let best = 0;
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized && haystack.includes(normalized)) best = Math.max(best, normalized.length);
  }
  return best;
}

/** 最長一致するエントリを返す。 */
function bestMatch<T>(value: string, entries: T[], keys: (entry: T) => string[]): T | null {
  const haystack = normalizeText(value);
  let winner: T | null = null;
  let winnerStrength = 0;
  for (const entry of entries) {
    const strength = matchStrength(haystack, keys(entry));
    if (strength > winnerStrength) {
      winner = entry;
      winnerStrength = strength;
    }
  }
  return winner;
}

/** 自由記述テキストから既知スキルを抽出する。 */
export function extractSkills(text: string): SkillDef[] {
  const normalized = normalizeText(text);
  return SKILLS.filter((s) => matchAny(normalized, [s.name, ...s.aliases]));
}

/** 自由記述テキストから資格名を抽出する (正式名称に正規化)。 */
export function extractQualifications(text: string): string[] {
  const normalized = normalizeText(text);
  return QUALIFICATIONS.filter((q) => matchAny(normalized, [q.name, ...q.aliases])).map((q) => q.name);
}

/** 職種名の正規化。未知の値はそのまま返す。 */
export function normalizeJobCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  const hit = bestMatch(value, JOB_CATEGORIES, (c) => [c.name, ...c.aliases]);
  return hit?.name ?? value;
}

/** スキル名の正規化。 */
export function normalizeSkill(value: string): string {
  const hit = bestMatch(value, SKILLS, (s) => [s.name, ...s.aliases]);
  return hit?.name ?? value.trim();
}

export function skillCategory(name: string): SkillDef['category'] {
  return SKILLS.find((s) => s.name === name)?.category ?? 'domain';
}

/** 資格名の正規化。 */
export function normalizeQualification(value: string): string {
  const hit = bestMatch(value, QUALIFICATIONS, (q) => [q.name, ...q.aliases]);
  return hit?.name ?? value.trim();
}
