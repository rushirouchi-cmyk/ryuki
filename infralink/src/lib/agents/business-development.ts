import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';
import { writeAudit } from '@/lib/audit';
import { getBdWeights, getFocusAreas, BD_WEIGHT_LABELS, type BdWeights } from '@/lib/settings';
import { coarseLocation, stripNames } from '@/lib/domain/anonymize';
import { normalizeJobCategory } from '@/lib/domain/taxonomy';

/**
 * Agent 04: Business Development Agent (§17〜§20)。
 *
 * Market Research Agent が発見した企業について「営業すべきか」を評価する。
 * 重要なのは 1 候補者だけで判断しないこと (§19)。
 * 保有候補者プール全体との相性を見て、継続的な取引先になり得るかを測る。
 */

export type BdFactor = { key: string; label: string; weight: number; earned: number; note: string };

export type BdEvaluation = {
  companyId: string;
  companyName: string;
  score: number;
  factors: BdFactor[];
  matchingCandidateCount: number;
  sRankCount: number;
  aRankCount: number;
  hiringDemandScore: number;
  reason: string;
  approachAngle: string;
  targetDepartment: string;
  draftMessage: string;
  recommendedAction: string;
  activeFindings: { jobTitle: string; sourceUrl: string; lastVerifiedAt: Date }[];
};

/** 候補者マッチとみなす下限スコア。 */
const MATCH_THRESHOLD = 60;

const round = (n: number) => Math.round(n * 10) / 10;

export async function evaluateCompany(companyId: string, weights: BdWeights, focusAreas: string[]): Promise<BdEvaluation | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      webFindings: { where: { activeStatus: 'active' }, orderBy: { lastVerifiedAt: 'desc' } },
      matches: { include: { candidate: true } },
      jobs: true,
    },
  });
  if (!company) return null;

  const matches = company.matches.filter((m) => m.matchScore >= MATCH_THRESHOLD);
  const candidateIds = new Set(matches.map((m) => m.candidateId));
  const rankOf = new Map<string, string | null>();
  for (const m of matches) rankOf.set(m.candidateId, m.candidate?.rank ?? null);

  const sRankCount = [...rankOf.values()].filter((r) => r === 'S').length;
  const aRankCount = [...rankOf.values()].filter((r) => r === 'A').length;
  const topMatch = [...matches].sort((a, b) => b.matchScore - a.matchScore)[0] ?? null;

  const factors: BdFactor[] = [];

  // ------------------------------------------------------- 候補者適合度 (30)
  {
    const w = weights.candidateFit;
    const best = topMatch?.matchScore ?? 0;
    factors.push({
      key: 'candidateFit',
      label: BD_WEIGHT_LABELS.candidateFit,
      weight: w,
      earned: round((best / 100) * w),
      note: topMatch
        ? `最上位候補者の Match Score ${best}`
        : '一定スコア以上の候補者マッチなし',
    });
  }

  // ------------------------------------------------------ 現在の採用需要 (25)
  {
    const w = weights.hiringDemand;
    const findings = company.webFindings;
    const freshest = findings[0]?.lastVerifiedAt ?? null;
    const daysSince = freshest ? (Date.now() - freshest.getTime()) / 86_400_000 : Infinity;
    // 公開求人の件数と情報の鮮度から需要を推定する。
    const volumeScore = Math.min(1, findings.length / 3);
    const freshnessScore = daysSince <= 14 ? 1 : daysSince <= 30 ? 0.7 : daysSince <= 60 ? 0.4 : 0.1;
    const earned = w * volumeScore * freshnessScore;
    factors.push({
      key: 'hiringDemand',
      label: BD_WEIGHT_LABELS.hiringDemand,
      weight: w,
      earned: round(earned),
      note: findings.length
        ? `公開求人 ${findings.length} 件 / 最終確認 ${Math.round(daysSince)} 日前`
        : '公開求人情報が未取得',
    });
  }

  // -------------------------------------------------- 保有候補者との相性 (15)
  {
    const w = weights.poolAffinity;
    // 1 名だけ合う企業より、プール全体と合う企業を優先する (§19)。
    const count = candidateIds.size;
    const earned = w * Math.min(1, count / 8);
    factors.push({
      key: 'poolAffinity',
      label: BD_WEIGHT_LABELS.poolAffinity,
      weight: w,
      earned: round(earned),
      note: `Match ${MATCH_THRESHOLD} 以上の保有候補者 ${count} 名 (S:${sRankCount} / A:${aRankCount})`,
    });
  }

  // ------------------------------------------------ 当社重点領域との相性 (10)
  {
    const w = weights.focusArea;
    const text = [
      company.industry ?? '',
      ...company.webFindings.map((f) => `${f.jobTitle} ${f.requirements ?? ''}`),
      ...company.jobs.map((j) => `${j.jobTitle} ${j.jobCategory ?? ''}`),
    ].join(' ');
    const hits = focusAreas.filter((area) => text.includes(area));
    const earned = hits.length > 0 ? w * Math.min(1, hits.length / 2) : 0;
    factors.push({
      key: 'focusArea',
      label: BD_WEIGHT_LABELS.focusArea,
      weight: w,
      earned: round(earned),
      note: hits.length ? `重点領域と一致: ${hits.join('・')}` : '重点領域との明確な一致なし',
    });
  }

  // -------------------------------------------- 継続的な求人可能性 (10)
  {
    const w = weights.continuity;
    const size = company.employeeCount ?? 0;
    const distinctCategories = new Set(
      company.webFindings
        .map((f) => normalizeJobCategory(f.jobTitle))
        .filter((v): v is string => Boolean(v)),
    ).size;
    const sizeScore = size >= 1000 ? 1 : size >= 300 ? 0.6 : size > 0 ? 0.3 : 0.4;
    const varietyScore = Math.min(1, distinctCategories / 2);
    const earned = w * (sizeScore * 0.6 + varietyScore * 0.4);
    factors.push({
      key: 'continuity',
      label: BD_WEIGHT_LABELS.continuity,
      weight: w,
      earned: round(earned),
      note: `従業員規模 ${size || '不明'} / 募集職種の幅 ${distinctCategories} 種`,
    });
  }

  // -------------------------------------------------------- 採用規模 (5)
  {
    const w = weights.hiringVolume;
    const count = company.webFindings.length + company.jobs.length;
    factors.push({
      key: 'hiringVolume',
      label: BD_WEIGHT_LABELS.hiringVolume,
      weight: w,
      earned: round(w * Math.min(1, count / 4)),
      note: `確認できた募集ポジション ${count} 件`,
    });
  }

  // --------------------------------------------------- 推定紹介フィー (5)
  {
    const w = weights.estimatedFee;
    const salaries = matches
      .map((m) => m.candidate?.desiredSalary ?? m.candidate?.currentSalary ?? 0)
      .filter((s) => s > 0);
    const avg = salaries.length ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0;
    // 理論年収の 35% を想定フィーとし、600万円を基準に正規化する。
    const earned = avg > 0 ? w * Math.min(1, avg / 6_000_000) : w * 0.4;
    factors.push({
      key: 'estimatedFee',
      label: BD_WEIGHT_LABELS.estimatedFee,
      weight: w,
      earned: round(earned),
      note: avg > 0 ? `対象候補者の平均希望年収 ${(avg / 10000).toFixed(0)}万円` : '年収情報が不足',
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((s, f) => s + f.earned, 0))));
  const hiringDemandScore = Math.round(
    (factors.find((f) => f.key === 'hiringDemand')!.earned / weights.hiringDemand) * 100,
  );

  const primaryCategory = dominantCategory(company) ?? '技術職';
  // 営業文面で述べる「支援中の候補者のエリア」は、企業所在地ではなく
  // マッチした候補者自身の居住地の最頻値から出す (事実と異なる記載を避けるため)。
  const area = dominantCandidateArea(matches);

  const reason = buildReason({
    companyName: company.companyName,
    candidateCount: candidateIds.size,
    sRankCount,
    aRankCount,
    topScore: topMatch?.matchScore ?? 0,
    category: primaryCategory,
    findingCount: company.webFindings.length,
  });

  // 切り口は「主に採用している職種」の求人を優先して引用する。
  // 直近に調査した候補者の職種の求人を引くと、開拓理由と食い違って読みにくくなる。
  const anchorFinding =
    company.webFindings.find((f) => normalizeJobCategory(f.jobTitle) === primaryCategory) ??
    company.webFindings[0] ??
    null;

  const anchorTitle = anchorFinding ? shortenJobTitle(anchorFinding.jobTitle, company.companyName) : null;

  const approachAngle = anchorTitle
    ? `公開中の「${anchorTitle}」に対し、即戦力人材の紹介提案から入る`
    : `${primaryCategory}領域の採用計画をヒアリングし、当社保有人材の概要提示から入る`;

  const targetDepartment = departmentFor(primaryCategory);

  // 営業文面には候補者個人を特定できる情報を入れない (§20/§21)。
  const draftMessage = stripNames(
    [
      `突然のご連絡失礼いたします。インフラリンク株式会社の${'{担当者名}'}と申します。`,
      `現在、${area ? `${area}を中心に` : ''}${primaryCategory}経験${matchExperienceLabel(matches)}の候補者を複数名支援しております。`,
      `御社の${anchorTitle ?? `${primaryCategory}求人`}との親和性が高いと考え、ご連絡いたしました。`,
      `${candidateIds.size}名の概要（経験領域・保有資格・希望条件）を匿名でご共有できればと存じます。`,
      `一度 15 分ほどお時間をいただけますでしょうか。`,
    ].join('\n'),
    matches.map((m) => m.candidate?.name),
  );

  const recommendedAction =
    score >= 85
      ? '今週中にアプローチ (最優先)'
      : score >= 70
        ? '今月中にアプローチ'
        : score >= 55
          ? '情報収集を継続し、求人が増えたら再評価'
          : '現時点では優先度低';

  return {
    companyId: company.id,
    companyName: company.companyName,
    score,
    factors,
    matchingCandidateCount: candidateIds.size,
    sRankCount,
    aRankCount,
    hiringDemandScore,
    reason,
    approachAngle,
    targetDepartment,
    draftMessage,
    recommendedAction,
    activeFindings: company.webFindings.map((f) => ({
      jobTitle: f.jobTitle,
      sourceUrl: f.sourceUrl,
      lastVerifiedAt: f.lastVerifiedAt,
    })),
  };
}

/**
 * その企業が主に何を採用しているかを決める。
 * 最新の 1 件だけを見ると、直近に調査した候補者の職種に引きずられるため、
 * WEB 求人と保有求人すべてから最頻の職種を採る。
 */
function dominantCategory(company: {
  webFindings: { jobTitle: string }[];
  jobs: { jobCategory: string | null }[];
}): string | null {
  const counts = new Map<string, number>();
  const add = (value: string | null) => {
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  };
  for (const finding of company.webFindings) add(normalizeJobCategory(finding.jobTitle));
  for (const job of company.jobs) add(normalizeJobCategory(job.jobCategory));

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked[0]?.[0] ?? null;
}

/** マッチした候補者の居住地のうち最も多い都道府県。判定できなければ null。 */
function dominantCandidateArea(matches: { candidate: { location: string | null } | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const match of matches) {
    const area = coarseLocation(match.candidate?.location);
    if (!area) continue;
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked[0]?.[0] ?? null;
}

/** 求人タイトルの先頭に企業名が含まれる場合に取り除く (文面が冗長になるため)。 */
function shortenJobTitle(title: string, companyName: string): string {
  return title.replace(companyName, '').replace(/^[\s|｜/–—-]+/, '').trim() || title;
}

/** 職種から想定する打診先部署 (§20)。 */
function departmentFor(category: string): string {
  if (/施工管理|建築設計/.test(category)) return '工事部門 / 人事採用担当';
  if (/設備保全|生産技術|プラント|機械設備|電気設備/.test(category)) return '製造・技術部門 / 人事採用担当';
  if (/サービスエンジニア/.test(category)) return 'サービス・カスタマーサポート部門 / 人事採用担当';
  if (/データセンター|ファシリティ/.test(category)) return '施設運用部門 / 人事採用担当';
  return '人事採用担当';
}

function matchExperienceLabel(matches: { candidate: { id: string } | null }[]) {
  return matches.length >= 5 ? '5年以上' : '複数年';
}

function buildReason(params: {
  companyName: string;
  candidateCount: number;
  sRankCount: number;
  aRankCount: number;
  topScore: number;
  category: string;
  findingCount: number;
}) {
  if (params.candidateCount === 0) {
    return `${params.category}領域で公開求人を ${params.findingCount} 件確認したが、現時点で高スコアの保有候補者はいない。求人内容の詳細確認が必要。`;
  }
  if (params.candidateCount === 1) {
    return `候補者1名 (Match ${params.topScore}) との適合が確認できるが、単発求人の可能性がある。他候補者との相性を追加確認したい。`;
  }
  return `最上位候補者との Match は ${params.topScore}。加えて当社保有の${params.category}人材 ${params.candidateCount}名 (Sランク ${params.sRankCount}名 / Aランク ${params.aRankCount}名) との親和性が高く、単発求人ではなく継続的な採用支援先になる可能性がある。`;
}

/**
 * 未取引・開拓中の企業をまとめて評価し、business_development_opportunities を更新する。
 * 営業進捗 (status) と担当 RA は人が管理するため、既存レコードでは上書きしない (§51)。
 */
export async function runBusinessDevelopmentRanking() {
  const [weights, focusAreas] = await Promise.all([getBdWeights(), getFocusAreas()]);
  const companies = await prisma.company.findMany({
    where: { transactionStatus: { in: ['unknown', 'prospect'] } },
    select: { id: true },
  });

  const evaluations: BdEvaluation[] = [];
  for (const { id } of companies) {
    const evaluation = await evaluateCompany(id, weights, focusAreas);
    if (!evaluation) continue;
    evaluations.push(evaluation);

    const existing = await prisma.businessDevelopmentOpportunity.findFirst({
      where: { companyId: id },
    });

    const data = {
      score: evaluation.score,
      breakdown: toJson(evaluation.factors),
      matchingCandidateCount: evaluation.matchingCandidateCount,
      sRankCount: evaluation.sRankCount,
      aRankCount: evaluation.aRankCount,
      hiringDemandScore: evaluation.hiringDemandScore,
      reason: evaluation.reason,
      recommendedAction: evaluation.recommendedAction,
      approachAngle: evaluation.approachAngle,
      targetDepartment: evaluation.targetDepartment,
      draftMessage: evaluation.draftMessage,
    };

    if (existing) {
      await prisma.businessDevelopmentOpportunity.update({ where: { id: existing.id }, data });
    } else {
      const created = await prisma.businessDevelopmentOpportunity.create({
        data: { companyId: id, ...data },
      });
      await writeAudit({
        actor: { type: 'AI', label: 'Business Development Agent' },
        entityType: 'business_development_opportunity',
        entityId: created.id,
        action: 'create',
        after: { score: evaluation.score, reason: evaluation.reason },
      });
    }
  }

  evaluations.sort((a, b) => b.score - a.score);
  return { evaluated: evaluations.length, top: evaluations.slice(0, 10) };
}
