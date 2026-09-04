import { prisma } from '@/lib/db';
import { normalizeJobCategory } from './taxonomy';
import type { CandidateProfile } from './structuring';

/**
 * ナレッジ蓄積・集計 (§12/§33/§35)。
 *
 * 「どんな候補者が / どの求人を提案され / どこへ応募し / どこまで通過したか」を
 * 集計し、マッチング表示と経営レポートに使う。
 */

export type FunnelStats = {
  proposed: number;
  applied: number;
  documentPassed: number;
  interview1Passed: number;
  offered: number;
  accepted: number;
  documentPassRate: number;
  interviewPassRate: number;
  offerRate: number;
  acceptanceRate: number;
};

const PASSED_DOCUMENT_STAGES = new Set([
  'interview_1',
  'interview_2',
  'final',
  'offer',
  'accepted',
]);

type ApplicationLike = {
  currentStage: string;
  documentResult: string | null;
  interview1Result: string | null;
  offerStatus: string | null;
  acceptanceStatus: string | null;
};

export function computeFunnel(applications: ApplicationLike[]): FunnelStats {
  const applied = applications.length;
  const documentPassed = applications.filter(
    (a) => a.documentResult === 'pass' || PASSED_DOCUMENT_STAGES.has(a.currentStage),
  ).length;
  const interview1Passed = applications.filter(
    (a) =>
      a.interview1Result === 'pass' ||
      ['interview_2', 'final', 'offer', 'accepted'].includes(a.currentStage),
  ).length;
  const offered = applications.filter(
    (a) => a.offerStatus === 'offered' || ['offer', 'accepted'].includes(a.currentStage),
  ).length;
  const accepted = applications.filter((a) => a.acceptanceStatus === 'accepted').length;

  const rate = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

  return {
    proposed: applied,
    applied,
    documentPassed,
    interview1Passed,
    offered,
    accepted,
    documentPassRate: rate(documentPassed, applied),
    interviewPassRate: rate(interview1Passed, documentPassed),
    offerRate: rate(offered, interview1Passed),
    acceptanceRate: rate(accepted, offered),
  };
}

/**
 * 類似候補者の過去実績 (§12)。
 * 「同じ主職種 × 経験年数 ±3年」を類似と定義する (ADR-005)。
 * 初期はデータが少ないため、件数が閾値未満なら統計を出さず件数のみ返す。
 */
export const SIMILARITY_MIN_SAMPLE = 5;

export async function similarCandidateOutcomes(profile: CandidateProfile, companyId?: string) {
  const category = profile.primaryCareer?.jobCategory ?? null;
  if (!category) {
    return { sampleSize: 0, reliable: false, stats: null as FunnelStats | null, definition: '主職種が不明のため類似判定不可' };
  }

  const candidates = await prisma.candidate.findMany({
    where: { id: { not: profile.id } },
    include: { careers: true, applications: true },
  });

  const similar = candidates.filter((c) => {
    const careers = c.careers.map((career) => ({
      cat: normalizeJobCategory(career.jobCategory),
      years: career.yearsExperience ?? 0,
    }));
    const hit = careers.find((career) => career.cat === category);
    if (!hit) return false;
    return Math.abs(hit.years - profile.totalYearsExperience) <= 3;
  });

  const applications = similar
    .flatMap((c) => c.applications)
    .filter((a) => (companyId ? a.companyId === companyId : true));

  return {
    sampleSize: similar.length,
    reliable: similar.length >= SIMILARITY_MIN_SAMPLE,
    stats: applications.length > 0 ? computeFunnel(applications) : null,
    definition: `主職種「${category}」かつ経験年数 ${Math.round(profile.totalYearsExperience)}年 ±3年`,
  };
}

/** 軸別集計 (§33)。職種別・業界別・年齢別・資格別・経験年数別・企業別。 */
export type BreakdownRow = { key: string; label: string; stats: FunnelStats };

export async function breakdownBy(
  axis: 'jobCategory' | 'industry' | 'ageBand' | 'qualification' | 'experienceBand' | 'company',
): Promise<BreakdownRow[]> {
  const applications = await prisma.application.findMany({
    include: {
      company: true,
      candidate: { include: { careers: true, qualifications: true } },
    },
  });

  const buckets = new Map<string, ApplicationLike[]>();
  const push = (key: string, app: ApplicationLike) => {
    buckets.set(key, [...(buckets.get(key) ?? []), app]);
  };

  for (const app of applications) {
    const careers = app.candidate.careers;
    const primary = [...careers].sort((a, b) => (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0))[0];
    const years = careers.reduce((s, c) => s + (c.yearsExperience ?? 0), 0);

    switch (axis) {
      case 'jobCategory':
        push(normalizeJobCategory(primary?.jobCategory) ?? '不明', app);
        break;
      case 'industry':
        push(primary?.industry ?? '不明', app);
        break;
      case 'ageBand': {
        const age = app.candidate.age;
        push(age ? `${Math.floor(age / 5) * 5}〜${Math.floor(age / 5) * 5 + 4}歳` : '不明', app);
        break;
      }
      case 'qualification': {
        const quals = app.candidate.qualifications;
        if (quals.length === 0) push('資格なし', app);
        for (const q of quals) push(q.qualificationName, app);
        break;
      }
      case 'experienceBand':
        push(years >= 15 ? '15年以上' : years >= 10 ? '10〜14年' : years >= 5 ? '5〜9年' : '5年未満', app);
        break;
      case 'company':
        push(app.company.companyName, app);
        break;
    }
  }

  return [...buckets.entries()]
    .map(([key, apps]) => ({ key, label: key, stats: computeFunnel(apps) }))
    .sort((a, b) => b.stats.applied - a.stats.applied);
}

/**
 * キャリアチェンジ成功パターン (§35)。
 * 「候補者の主職種 → 応募求人の職種」の遷移ごとに通過率を集計する。
 */
export type CareerChangePattern = {
  from: string;
  to: string;
  recommended: number;
  documentPassed: number;
  offered: number;
  accepted: number;
  documentPassRate: number;
};

export async function careerChangePatterns(): Promise<CareerChangePattern[]> {
  const applications = await prisma.application.findMany({
    include: { candidate: { include: { careers: true } }, job: true },
  });

  const map = new Map<string, CareerChangePattern>();
  for (const app of applications) {
    const primary = [...app.candidate.careers].sort(
      (a, b) => (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0),
    )[0];
    const from = normalizeJobCategory(primary?.jobCategory);
    const to = normalizeJobCategory(app.job?.jobCategory);
    if (!from || !to) continue;

    const key = `${from}→${to}`;
    const row =
      map.get(key) ??
      { from, to, recommended: 0, documentPassed: 0, offered: 0, accepted: 0, documentPassRate: 0 };
    row.recommended += 1;
    if (app.documentResult === 'pass' || PASSED_DOCUMENT_STAGES.has(app.currentStage)) row.documentPassed += 1;
    if (app.offerStatus === 'offered' || ['offer', 'accepted'].includes(app.currentStage)) row.offered += 1;
    if (app.acceptanceStatus === 'accepted') row.accepted += 1;
    map.set(key, row);
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      documentPassRate: r.recommended === 0 ? 0 : Math.round((r.documentPassed / r.recommended) * 1000) / 10,
    }))
    .sort((a, b) => b.recommended - a.recommended);
}

/** 見送り理由タグの集計 (§34)。 */
export async function rejectionTagStats() {
  const rows = await prisma.application.findMany({
    where: { rejectionReasonOriginal: { not: null } },
    select: { rejectionReasonTag: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.rejectionReasonTag ?? 'untagged';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
