import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';
import { writeAudit } from '@/lib/audit';
import { getAiProvider, safeJsonParse } from '@/lib/adapters/ai';
import { getMatchWeights } from '@/lib/settings';
import { buildJobProfile, loadProfile, type CandidateProfile } from '@/lib/domain/structuring';
import { rankJobs, scoreCandidateJob } from '@/lib/domain/matching';
import {
  extractQualifications,
  extractSkills,
  normalizeQualification,
  normalizeSkill,
  skillCategory,
} from '@/lib/domain/taxonomy';

/**
 * Agent 02: Matching Agent (§10/§11/§12/§37/§38)。
 *
 * 1) 候補者の自由記述からスキル・資格を構造化する
 * 2) PORTERS 内求人とのマッチングスコアを算出し、根拠付きで保存する
 *
 * 「自動更新可能な範囲」に限定し (§51)、選考辞退や年収希望の変更など
 * 重要情報は AI が確定しない。
 */

// ------------------------------------------------------------- 構造化 (§10)

export type StructuringResult = {
  skills: { name: string; category: string; evidence: string }[];
  qualifications: string[];
  summary: string;
  provider: string;
  degraded: boolean;
};

/** ルールベース抽出。LLM 不在でも必ず動く土台。 */
export function structureByRule(text: string): StructuringResult {
  const skills = extractSkills(text).map((s) => ({
    name: s.name,
    category: s.category,
    evidence: extractEvidence(text, [s.name, ...s.aliases]),
  }));
  const qualifications = extractQualifications(text);
  return {
    skills,
    qualifications,
    summary: text.slice(0, 200),
    provider: 'rule',
    degraded: true,
  };
}

/** 該当キーワードを含む一文を根拠として切り出す (§37 説明可能性)。 */
function extractEvidence(text: string, keywords: string[]): string {
  const sentences = text.split(/[。\n]/).map((s) => s.trim()).filter(Boolean);
  const lowered = keywords.map((k) => k.toLowerCase());
  const hit = sentences.find((s) => lowered.some((k) => s.toLowerCase().includes(k)));
  return hit ? `${hit}。` : '';
}

/** LLM を使った構造化。degraded の場合はルールベース結果を採用する。 */
export async function structureCandidateText(text: string): Promise<StructuringResult> {
  const rule = structureByRule(text);
  const provider = getAiProvider();
  if (provider.name === 'mock' || !text.trim()) return rule;

  const completion = await provider.complete(
    [
      {
        role: 'system',
        content:
          'あなたは日本のメーカー・建設・エネルギー領域に詳しい人材紹介のリサーチャーです。' +
          '職務経歴から技術スキルと資格のみを抽出します。記述に無いものを推測して追加してはいけません。',
      },
      {
        role: 'user',
        content: [
          '次の職務経歴テキストから、技術スキルと保有資格を抽出してください。',
          '各スキルには、抽出根拠となった原文の一文を evidence として付けてください。',
          '',
          text,
          '',
          'JSON のみを出力: {"skills":[{"name":"","category":"technical|equipment|software|domain|management","evidence":""}],"qualifications":[""],"summary":""}',
        ].join('\n'),
      },
    ],
    { json: true },
  );
  if (completion.degraded) return rule;

  const parsed = safeJsonParse<{
    skills?: { name?: string; category?: string; evidence?: string }[];
    qualifications?: string[];
    summary?: string;
  }>(completion.text);
  if (!parsed) return rule;

  // AI 結果とルール結果をマージする。ルールで確実に取れたものは残す。
  const merged = new Map<string, { name: string; category: string; evidence: string }>();
  for (const s of rule.skills) merged.set(s.name, s);
  for (const s of parsed.skills ?? []) {
    if (!s.name) continue;
    const name = normalizeSkill(s.name);
    merged.set(name, {
      name,
      category: s.category ?? skillCategory(name),
      evidence: s.evidence ?? merged.get(name)?.evidence ?? '',
    });
  }

  const quals = new Set(rule.qualifications);
  for (const q of parsed.qualifications ?? []) quals.add(normalizeQualification(q));

  return {
    skills: [...merged.values()],
    qualifications: [...quals],
    summary: parsed.summary ?? rule.summary,
    provider: completion.provider,
    degraded: false,
  };
}

/** 候補者 1 名の構造化結果を DB へ反映する。人が入力した値 (source='human') は上書きしない。 */
export async function structureCandidate(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { careers: true, skills: true, qualifications: true },
  });
  if (!candidate) throw new Error('候補者が見つかりません');

  const text = [
    candidate.aiSummary ?? '',
    ...candidate.careers.map((c) =>
      [c.companyName, c.industry, c.jobCategory, c.jobTitle, c.description].filter(Boolean).join(' '),
    ),
  ].join('\n');

  const result = await structureCandidateText(text);

  for (const skill of result.skills) {
    const existing = candidate.skills.find((s) => s.skillName === skill.name);
    if (existing?.source === 'human') continue;
    await prisma.candidateSkill.upsert({
      where: { candidateId_skillName: { candidateId, skillName: skill.name } },
      create: {
        candidateId,
        skillName: skill.name,
        skillCategory: skill.category,
        evidence: skill.evidence,
        source: 'ai',
      },
      update: { skillCategory: skill.category, evidence: skill.evidence },
    });
  }

  for (const name of result.qualifications) {
    await prisma.candidateQualification.upsert({
      where: { candidateId_qualificationName: { candidateId, qualificationName: name } },
      create: { candidateId, qualificationName: name, source: 'ai' },
      update: {},
    });
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { aiStructuredAt: new Date(), aiSummary: result.summary || candidate.aiSummary },
  });

  await prisma.aiInteraction.create({
    data: {
      agentType: 'matching',
      candidateId,
      question: '職務経歴の構造化',
      structuredResult: toJson(result),
      provider: result.provider,
      confidence: result.degraded ? 'Low' : 'Medium',
    },
  });

  await writeAudit({
    actor: { type: 'AI', label: 'Matching Agent' },
    entityType: 'candidate',
    entityId: candidateId,
    action: 'update',
    after: { skills: result.skills.map((s) => s.name), qualifications: result.qualifications },
  });

  return result;
}

// --------------------------------------------------------- マッチング (§11)

export async function loadOpenJobProfiles() {
  const jobs = await prisma.job.findMany({
    where: { status: 'open' },
    include: { company: true },
  });
  return jobs.map(buildJobProfile);
}

/** 1 候補者について PORTERS 内求人とのマッチングを再計算し保存する。 */
export async function refreshCandidateMatches(candidateId: string, limit = 10) {
  const profile = await loadProfile(candidateId);
  if (!profile) throw new Error('候補者が見つかりません');
  const [weights, jobs] = await Promise.all([getMatchWeights(), loadOpenJobProfiles()]);

  const ranked = rankJobs(profile, jobs, weights, limit);

  // 既存の内部求人マッチは作り直す (再現性のため)。Web 企業マッチは別 Agent が管理。
  await prisma.candidateCompanyMatch.deleteMany({
    where: { candidateId, matchType: 'internal_job' },
  });

  for (const { job, result } of ranked) {
    await prisma.candidateCompanyMatch.create({
      data: {
        candidateId,
        companyId: job.companyId,
        jobId: job.id,
        matchType: 'internal_job',
        matchScore: result.score,
        breakdown: toJson({ factors: result.factors, adjustments: result.adjustments }),
        matchReason: toJson(result.reasons),
        risk: toJson(result.risks),
        missingInfo: toJson(result.missingInfo),
        confidence: result.confidence,
      },
    });
  }

  return ranked;
}

/** 全稼働候補者のマッチングを再計算する (定期実行用)。 */
export async function refreshAllMatches() {
  const candidates = await prisma.candidate.findMany({
    where: { status: 'active' },
    select: { id: true },
  });
  let total = 0;
  for (const c of candidates) {
    const ranked = await refreshCandidateMatches(c.id);
    total += ranked.length;
  }
  return { candidates: candidates.length, matches: total };
}

/** 企業側から見た「マッチする現在候補者」(§27/§19)。 */
export async function candidatesForJob(jobId: string, limit = 20) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { company: true } });
  if (!job) return [];
  const jobProfile = buildJobProfile(job);
  const [weights, candidates] = await Promise.all([
    getMatchWeights(),
    prisma.candidate.findMany({
      where: { status: 'active' },
      include: { careers: true, skills: true, qualifications: true, preference: true },
    }),
  ]);

  const { buildProfile } = await import('@/lib/domain/structuring');
  return candidates
    .map((c) => {
      const profile: CandidateProfile = buildProfile(c);
      return { profile, result: scoreCandidateJob(profile, jobProfile, weights) };
    })
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, limit);
}
