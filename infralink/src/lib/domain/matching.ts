import type { MatchWeights } from '@/lib/settings';
import { DEFAULT_MATCH_WEIGHTS, MATCH_WEIGHT_LABELS } from '@/lib/settings';
import { coarseLocation } from './anonymize';
import type { CandidateProfile, JobProfile } from './structuring';
import type { AiConfidence } from './enums';

/**
 * 求人マッチングスコア (§11)。
 *
 * 設計原則:
 *  - ブラックボックス化しない (§37)。全要素の獲得点と理由を breakdown に残す。
 *  - 情報が無い項目は「推測で加点」せず、不足情報として明示する (§38)。
 *  - 重みは管理画面から変更可能 (DEFAULT_MATCH_WEIGHTS を settings で上書き)。
 */

export type ScoreFactor = {
  key: string;
  label: string;
  weight: number;
  earned: number;
  /** 何をもってこの点になったかの説明。UI にそのまま出す。 */
  note: string;
};

export type ScoreAdjustment = {
  label: string;
  points: number; // 負の値
};

export type MatchResult = {
  score: number;
  factors: ScoreFactor[];
  adjustments: ScoreAdjustment[];
  reasons: string[];
  risks: string[];
  missingInfo: string[];
  confidence: AiConfidence;
};

const round = (n: number) => Math.round(n * 10) / 10;

/** 2 つの地名が同一エリアかを判定する (都道府県一致 or 一方が他方を含む)。 */
function locationMatches(candidateLocations: string[], jobLocation: string | null) {
  if (!jobLocation) return null;
  const job = coarseLocation(jobLocation);
  if (!job) return null;
  for (const loc of candidateLocations) {
    const c = coarseLocation(loc);
    if (!c) continue;
    if (c === job || c.includes(job) || job.includes(c)) return true;
  }
  return false;
}

function overlap(a: string[], b: string[]) {
  const setB = new Set(b);
  // 求人側に同義語が並ぶことがあるため重複を除いて返す。
  return [...new Set(a.filter((x) => setB.has(x)))];
}

export function scoreCandidateJob(
  candidate: CandidateProfile,
  job: JobProfile,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): MatchResult {
  const factors: ScoreFactor[] = [];
  const adjustments: ScoreAdjustment[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];
  const missingInfo = [...candidate.missingInfo];

  // ---------------------------------------------------------- 経験職種
  {
    const w = weights.jobCategory;
    const target = job.jobCategory;
    let earned = 0;
    let note = '求人側の職種が未設定のため判定不可';
    if (!target) {
      missingInfo.push('求人の職種区分が未設定');
    } else if (candidate.jobCategories.includes(target)) {
      earned = w;
      note = `経験職種「${target}」が求人職種と一致`;
      reasons.push(`${target}の実務経験が求人要件と一致`);
    } else if (candidate.preference.desiredJobs.includes(target)) {
      earned = w * 0.7;
      note = `未経験だが希望職種に「${target}」を含む`;
      reasons.push(`希望職種に${target}を挙げている`);
    } else if (candidate.preference.acceptableJobs.includes(target)) {
      earned = w * 0.45;
      note = `許容職種に「${target}」を含む`;
    } else {
      note = `経験職種 (${candidate.jobCategories.join('・') || '不明'}) と求人職種 (${target}) が不一致`;
      risks.push(`${target}としての実務経験が確認できない`);
    }
    factors.push({ key: 'jobCategory', label: MATCH_WEIGHT_LABELS.jobCategory, weight: w, earned: round(earned), note });
  }

  // -------------------------------------------------------- 必須スキル
  {
    const w = weights.requiredSkills;
    const required = job.requiredSkills;
    let earned = 0;
    let note = '求人に必須スキルの記載なし';
    if (required.length === 0) {
      missingInfo.push('求人の必須スキルが未設定');
    } else {
      const hit = overlap(required, candidate.skills);
      const ratio = hit.length / required.length;
      earned = w * ratio;
      note = `必須 ${required.length} 件中 ${hit.length} 件一致 (${hit.join('・') || '一致なし'})`;
      if (hit.length > 0) reasons.push(`必須スキル ${hit.join('・')} を保有`);
      const missing = required.filter((s) => !candidate.skills.includes(s));
      if (missing.length > 0) risks.push(`必須スキル ${missing.join('・')} の経験が未確認`);
    }
    // 歓迎スキルは「その他」枠ではなくここで少量ボーナス化せず、下の other 枠で扱う。
    factors.push({ key: 'requiredSkills', label: MATCH_WEIGHT_LABELS.requiredSkills, weight: w, earned: round(earned), note });
  }

  // ---------------------------------------------------------- 業界経験
  {
    const w = weights.industry;
    let earned = 0;
    let note = '求人企業の業界が未設定';
    if (!job.industry) {
      missingInfo.push('求人企業の業界が未設定');
    } else if (candidate.industries.some((i) => i === job.industry)) {
      earned = w;
      note = `同業界 (${job.industry}) の経験あり`;
      reasons.push(`${job.industry}での実務経験あり`);
    } else if (candidate.industries.length > 0) {
      // 近接業界は半分。製造/プラント/建設は相互に転用が効くという運用知見に基づく。
      const adjacent = ['化学メーカー', '重工業', 'プラントエンジニアリング', '半導体', '機械メーカー', '電機メーカー', '素材メーカー', '自動車部品', '食品メーカー'];
      const isAdjacent = adjacent.includes(job.industry) && candidate.industries.some((i) => adjacent.includes(i));
      earned = isAdjacent ? w * 0.5 : 0;
      note = isAdjacent
        ? `同業界経験はないが近接業界 (${candidate.industries.join('・')}) の経験あり`
        : `業界経験なし (経験業界: ${candidate.industries.join('・')})`;
      if (!isAdjacent) risks.push(`${job.industry}の業界経験なし`);
    }
    factors.push({ key: 'industry', label: MATCH_WEIGHT_LABELS.industry, weight: w, earned: round(earned), note });
  }

  // -------------------------------------------------------------- 資格
  {
    const w = weights.qualification;
    const required = job.qualifications;
    let earned = 0;
    let note = '求人に必要資格の指定なし';
    if (required.length === 0) {
      // 指定が無い場合は満点でも 0 点でもなく、中立として満点扱いにすると
      // 資格保有者が不当に不利になるため、半分を配点する。
      earned = w * 0.5;
      note = '必要資格の指定がないため中立評価 (配点の50%)';
    } else {
      const hit = overlap(required, candidate.qualifications);
      earned = w * (hit.length / required.length);
      note = `必要資格 ${required.length} 件中 ${hit.length} 件保有 (${hit.join('・') || 'なし'})`;
      if (hit.length > 0) reasons.push(`${hit.join('・')}を保有`);
      const missing = required.filter((q) => !candidate.qualifications.includes(q));
      if (missing.length > 0) risks.push(`必要資格 ${missing.join('・')} が未保有`);
    }
    factors.push({ key: 'qualification', label: MATCH_WEIGHT_LABELS.qualification, weight: w, earned: round(earned), note });
  }

  // ------------------------------------------------------------ 勤務地
  {
    const w = weights.location;
    const desired = candidate.preference.desiredLocations.length
      ? candidate.preference.desiredLocations
      : candidate.location
        ? [candidate.location]
        : [];
    let earned = 0;
    let note = '希望勤務地が未取得';
    if (desired.length === 0 || !job.location) {
      missingInfo.push(job.location ? '候補者の希望勤務地が未取得' : '求人の勤務地が未設定');
    } else {
      const matched = locationMatches(desired, job.location);
      if (matched) {
        earned = w;
        note = `希望勤務地 (${desired.join('・')}) と求人勤務地 (${job.location}) が一致`;
        reasons.push('希望勤務地と一致');
      } else if (candidate.preference.transferAllowed === 'yes') {
        earned = w * 0.6;
        note = `希望エリア外だが転勤可のため一部加点 (求人: ${job.location})`;
      } else if (candidate.preference.transferAllowed === 'negotiable') {
        earned = w * 0.3;
        note = `希望エリア外。転勤は要相談 (求人: ${job.location})`;
        risks.push(`希望勤務地 (${desired.join('・')}) と求人勤務地 (${job.location}) が不一致`);
      } else {
        note = `希望勤務地と不一致 (求人: ${job.location})`;
        risks.push(`勤務地が希望と不一致 (${job.location})`);
      }
    }
    factors.push({ key: 'location', label: MATCH_WEIGHT_LABELS.location, weight: w, earned: round(earned), note });
  }

  // -------------------------------------------------------------- 年収
  {
    const w = weights.salary;
    const floor = candidate.minimumSalary ?? candidate.currentSalary;
    const desired = candidate.desiredSalary;
    let earned = 0;
    let note = '年収情報が不足';
    if (!job.salaryMax && !job.salaryMin) {
      missingInfo.push('求人の想定年収が未設定');
    } else if (!floor && !desired) {
      missingInfo.push('候補者の希望年収・現年収が未取得');
    } else {
      const max = job.salaryMax ?? job.salaryMin ?? 0;
      const min = job.salaryMin ?? 0;
      if (desired && max >= desired) {
        earned = w;
        note = `希望年収 ${(desired / 10000).toFixed(0)}万円が求人上限 ${(max / 10000).toFixed(0)}万円の範囲内`;
        reasons.push('希望年収レンジ内');
      } else if (floor && max >= floor) {
        earned = w * 0.6;
        note = `最低希望 ${(floor / 10000).toFixed(0)}万円は満たすが希望額には届かない可能性`;
        risks.push('希望年収に届かない可能性がある');
      } else {
        note = `求人上限 ${(max / 10000).toFixed(0)}万円が最低希望 ${((floor ?? 0) / 10000).toFixed(0)}万円を下回る`;
        risks.push('提示可能年収が最低希望額を下回る');
      }
      if (min && floor && min > floor * 1.3) {
        note += ' / 求人下限が現年収を大きく上回るため要件難易度に注意';
      }
    }
    factors.push({ key: 'salary', label: MATCH_WEIGHT_LABELS.salary, weight: w, earned: round(earned), note });
  }

  // -------------------------------------------------------- 希望仕事内容
  {
    const w = weights.desiredWork;
    const target = job.jobCategory;
    let earned = 0;
    let note = '希望職種が未取得';
    const { desiredJobs, acceptableJobs, priorities } = candidate.preference;
    if (desiredJobs.length === 0) {
      missingInfo.push('候補者の希望職種が未取得');
    } else if (target && desiredJobs.includes(target)) {
      earned = w;
      note = `希望職種 (${desiredJobs.join('・')}) に合致`;
    } else if (target && acceptableJobs.includes(target)) {
      earned = w * 0.5;
      note = `許容職種に含まれる (第一希望ではない)`;
    } else {
      note = `希望職種 (${desiredJobs.join('・')}) と求人職種が異なる`;
      risks.push('第一希望の職種ではないため意向確認が必要');
    }
    // 優先軸 (WLB/大手志向 等) は求人側属性が未整備のため加点対象外とし、確認事項として扱う。
    if (priorities.includes('WLB') && /夜勤|交替|24時間/.test(job.description ?? '')) {
      risks.push('WLB 重視の候補者に対し交替勤務を含む求人');
    }
    factors.push({ key: 'desiredWork', label: MATCH_WEIGHT_LABELS.desiredWork, weight: w, earned: round(earned), note });
  }

  // ------------------------------------------------------------ その他
  {
    const w = weights.other;
    const preferred = overlap(job.preferredSkills, candidate.skills);
    let earned = preferred.length > 0 ? w * Math.min(1, preferred.length / Math.max(1, job.preferredSkills.length)) : 0;
    let note = preferred.length
      ? `歓迎スキル ${preferred.join('・')} を保有`
      : '歓迎スキルの一致なし';
    // マネジメント経験は求人がリーダー/PM を求める場合に加点。
    if (/リーダー|マネジャー|マネージャー|PM|管理職|課長/.test(job.jobTitle) && candidate.managementCount) {
      earned = w;
      note += ` / ${candidate.managementCount}名のマネジメント経験あり`;
      reasons.push(`${candidate.managementCount}名規模のマネジメント経験`);
    }
    factors.push({ key: 'other', label: MATCH_WEIGHT_LABELS.other, weight: w, earned: round(earned), note });
  }

  // -------------------------------------------------------------- 減点
  if (job.jobCategory && candidate.preference.ngJobs.includes(job.jobCategory)) {
    adjustments.push({ label: `NG職種 (${job.jobCategory}) に該当`, points: -30 });
    risks.push(`候補者が NG としている職種`);
  }
  if (candidate.preference.nightShiftAllowed === 'no' && /夜勤|交替勤務|シフト/.test(`${job.jobTitle}${job.description ?? ''}`)) {
    adjustments.push({ label: '夜勤不可の候補者に夜勤あり求人', points: -10 });
    risks.push('夜勤の可否が条件と合わない');
  }
  if (candidate.preference.transferAllowed === 'no' && /全国|転勤あり/.test(job.description ?? '')) {
    adjustments.push({ label: '転勤不可の候補者に転勤あり求人', points: -8 });
  }

  const base = factors.reduce((sum, f) => sum + f.earned, 0);
  const penalty = adjustments.reduce((sum, a) => sum + a.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(base + penalty)));

  // ------------------------------------------------------- Confidence (§38)
  const uniqueMissing = [...new Set(missingInfo)];
  const confidence: AiConfidence =
    uniqueMissing.length === 0 ? 'High' : uniqueMissing.length <= 2 ? 'Medium' : 'Low';

  return {
    score,
    factors,
    adjustments,
    reasons: [...new Set(reasons)],
    risks: [...new Set(risks)],
    missingInfo: uniqueMissing,
    confidence,
  };
}

/** 上位 N 件のマッチングを返す。 */
export function rankJobs(
  candidate: CandidateProfile,
  jobs: JobProfile[],
  weights: MatchWeights,
  limit = 10,
) {
  return jobs
    .map((job) => ({ job, result: scoreCandidateJob(candidate, job, weights) }))
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, limit);
}
