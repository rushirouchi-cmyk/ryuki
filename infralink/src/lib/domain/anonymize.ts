import type { CandidateProfile } from './structuring';

/**
 * 個人情報保護 (§21)。
 *
 * Web 検索 Agent および企業向け営業文面には、氏名・メール・電話・詳細住所などの
 * 直接識別情報を渡さない。ここを通したデータだけを外部に出す。
 */

/** 都道府県までに丸める。市区町村以下は落とす。 */
export function coarseLocation(location: string | null | undefined): string {
  if (!location) return '';
  const match = location.match(/^(.+?[都道府県])/);
  return match ? match[1] : location.split(/[市区町村郡]/)[0];
}

export type AnonymizedProfile = {
  /** 例: 「34歳 / 大阪府 / 化学メーカー / 設備保全8年 / PLC / 電験三種」 */
  summary: string;
  ageBand: string;
  location: string;
  industry: string;
  jobCategory: string;
  yearsExperience: number;
  skills: string[];
  qualifications: string[];
};

/** 検索・営業文面用の匿名プロフィールを作る。氏名/連絡先は一切含めない。 */
export function anonymizeProfile(profile: CandidateProfile): AnonymizedProfile {
  const age = profile.age ?? null;
  const ageBand = age ? `${age}歳` : '年齢非公開';
  const location = coarseLocation(profile.location);
  const primary = profile.primaryCareer;
  const years = Math.round(profile.totalYearsExperience);

  const summary = [
    ageBand,
    location,
    primary?.industry ?? '',
    primary?.jobCategory ? `${primary.jobCategory}${years > 0 ? `${years}年` : ''}` : '',
    ...profile.skills.slice(0, 3),
    ...profile.qualifications.slice(0, 2),
  ]
    .filter(Boolean)
    .join(' / ');

  return {
    summary,
    ageBand,
    location,
    industry: primary?.industry ?? '',
    jobCategory: primary?.jobCategory ?? '',
    yearsExperience: years,
    skills: profile.skills,
    qualifications: profile.qualifications,
  };
}

/** 直接識別情報が紛れ込んでいないかの防御的チェック。検索クエリ生成前に必ず通す。 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // メールアドレス
  /0\d{1,4}-?\d{1,4}-?\d{3,4}/, // 電話番号
  /\d{1,3}丁目/, // 詳細住所
  /\d+-\d+-\d+/, // 番地
];

export function assertNoDirectIdentifiers(text: string, context: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`個人情報保護違反の可能性: ${context} に直接識別情報が含まれています`);
    }
  }
}

/** 氏名が含まれていないことを個別に検証する (氏名は正規表現では判定できないため明示的に渡す)。 */
export function stripNames(text: string, names: (string | null | undefined)[]) {
  let out = text;
  for (const name of names) {
    if (!name) continue;
    for (const part of name.split(/[\s　]+/).filter(Boolean)) {
      out = out.split(part).join('（候補者）');
    }
  }
  return out;
}
