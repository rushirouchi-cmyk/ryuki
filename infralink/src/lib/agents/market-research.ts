import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';
import { writeAudit } from '@/lib/audit';
import { getSearchProvider, SOURCE_TYPE_PRIORITY, type SearchResult } from '@/lib/adapters/search';
import { anonymizeProfile, assertNoDirectIdentifiers, type AnonymizedProfile } from '@/lib/domain/anonymize';
import { loadProfile, type CandidateProfile } from '@/lib/domain/structuring';
import { extractQualifications, extractSkills } from '@/lib/domain/taxonomy';

/**
 * Agent 03: Market Research Agent (§13〜§16/§21)。
 *
 * 保有求人が無くても、候補者の経歴から「採用可能性のある企業」を WEB 上に探す。
 * これは求人→候補者ではなく 候補者→企業 の逆方向マッチング
 * (Candidate Driven Business Development) である (§16)。
 *
 * 重要: 検索クエリには氏名・連絡先・詳細住所を渡さない (§21)。
 * 必ず anonymizeProfile() を通した匿名プロフィールのみを使う。
 */

export type ResearchFinding = {
  companyId: string;
  companyName: string;
  transactionStatus: string;
  jobTitle: string;
  sourceUrl: string;
  sourceType: SearchResult['sourceType'];
  location: string | null;
  requirements: string;
  estimatedFit: number;
  isNewProspect: boolean;
};

export type ResearchResult = {
  anonymizedProfile: AnonymizedProfile;
  query: string[];
  provider: string;
  findings: ResearchFinding[];
  newProspectCount: number;
};

/** 匿名プロフィールから検索キーワードを組み立てる。 */
export function buildSearchKeywords(anon: AnonymizedProfile): string[] {
  const keywords = [
    anon.jobCategory,
    ...anon.skills.slice(0, 3),
    ...anon.qualifications.slice(0, 2),
    anon.industry,
  ].filter((v): v is string => Boolean(v && v.length > 0));
  return [...new Set(keywords)];
}

/**
 * 検索結果のタイトル / URL から企業名を推定する。
 * 判定できないものは取り込まない (誤った企業レコードを作らないため)。
 */
export function extractCompanyName(result: SearchResult): string | null {
  // 「〇〇株式会社 ...」形式を優先。
  const corp = result.title.match(/([^\s|｜/–—-]*(?:株式会社|有限会社|合同会社)[^\s|｜/–—-]*)/);
  if (corp) return corp[1].trim();

  // 「会社名 | 採用情報」形式。
  const segments = result.title.split(/[|｜/–—-]/).map((s) => s.trim()).filter(Boolean);
  const named = segments.find((s) => /(株式会社|会社|グループ|ホールディングス)/.test(s));
  if (named) return named;

  return null;
}

/** 候補者スキルと求人要件テキストの重なりから推定適合度 (0-100) を出す。 */
export function estimateFit(profile: CandidateProfile, text: string): number {
  const skills = extractSkills(text).map((s) => s.name);
  const quals = extractQualifications(text);
  if (skills.length === 0 && quals.length === 0) return 40; // 情報不足時は中立寄り

  const skillHit = skills.filter((s) => profile.skills.includes(s)).length;
  const qualHit = quals.filter((q) => profile.qualifications.includes(q)).length;
  const skillScore = skills.length ? (skillHit / skills.length) * 70 : 35;
  const qualScore = quals.length ? (qualHit / quals.length) * 30 : 15;
  return Math.round(Math.max(0, Math.min(100, skillScore + qualScore)));
}

/**
 * 1 候補者について WEB 調査を実行する。
 * 発見した企業は companies に登録し (未取引なら transaction_status='unknown')、
 * 求人情報は web_job_findings に情報源・取得日・最終確認日つきで保存する (§14)。
 */
export async function researchForCandidate(candidateId: string, limit = 8): Promise<ResearchResult> {
  const profile = await loadProfile(candidateId);
  if (!profile) throw new Error('候補者が見つかりません');

  const anon = anonymizeProfile(profile);
  const keywords = buildSearchKeywords(anon);

  // 匿名化の実効性を送信前に検証する (§21)。
  const queryText = [...keywords, anon.location].join(' ');
  assertNoDirectIdentifiers(queryText, 'WEB 検索クエリ');
  if (profile.name && queryText.includes(profile.name)) {
    throw new Error('個人情報保護違反の可能性: 検索クエリに候補者氏名が含まれています');
  }

  const provider = getSearchProvider();
  const results = await provider.search({ keywords, location: anon.location, limit });

  // 信頼できる情報源を優先する (§14)。
  const sorted = [...results].sort(
    (a, b) => SOURCE_TYPE_PRIORITY[a.sourceType] - SOURCE_TYPE_PRIORITY[b.sourceType],
  );

  const findings: ResearchFinding[] = [];
  const now = new Date();

  for (const result of sorted) {
    const companyName = extractCompanyName(result);
    if (!companyName) continue;

    let company = await prisma.company.findFirst({ where: { companyName } });
    let isNew = false;
    if (!company) {
      company = await prisma.company.create({
        data: {
          companyName,
          // 自社 DB に無い = 未取引 (§15)。
          transactionStatus: 'unknown',
          relationshipStatus: 'none',
          // 検索結果から所在地が判明した場合のみ設定する。
          // 候補者の希望勤務地を企業所在地として保存すると誤情報になる。
          location: result.location ?? null,
          website: safeOrigin(result.url),
          note: 'Market Research Agent が WEB から発見',
        },
      });
      isNew = true;
      await writeAudit({
        actor: { type: 'AI', label: 'Market Research Agent' },
        entityType: 'company',
        entityId: company.id,
        action: 'create',
        after: { companyName, transactionStatus: 'unknown', source: result.url },
      });
    }

    const requirements = result.snippet.slice(0, 500);
    const fit = estimateFit(profile, `${result.title} ${result.snippet}`);

    // 同一 URL の findings は更新して「最終確認日」を進める (§14 鮮度)。
    const existing = await prisma.webJobFinding.findFirst({ where: { sourceUrl: result.url } });
    const finding = existing
      ? await prisma.webJobFinding.update({
          where: { id: existing.id },
          data: { lastVerifiedAt: now, requirements, estimatedFit: fit, activeStatus: 'active' },
        })
      : await prisma.webJobFinding.create({
          data: {
            companyId: company.id,
            jobTitle: result.title,
            sourceUrl: result.url,
            sourceType: result.sourceType,
            location: result.location ?? null,
            requirements,
            estimatedFit: fit,
            foundAt: now,
            lastVerifiedAt: now,
          },
        });

    // 候補者 → 企業の逆マッチとして保存する (§16)。
    await prisma.candidateCompanyMatch.upsert({
      where: { id: `${candidateId}_${finding.id}`.slice(0, 200) },
      create: {
        id: `${candidateId}_${finding.id}`.slice(0, 200),
        candidateId,
        companyId: company.id,
        findingId: finding.id,
        matchType: 'web_company',
        matchScore: fit,
        matchReason: toJson([`WEB 上の求人情報 (${result.sourceType}) と経歴の親和性`]),
        risk: toJson(['WEB 公開情報のみに基づく推定であり、実際の要件は要確認']),
        missingInfo: toJson(profile.missingInfo),
        confidence: result.sourceType === 'official_career' ? 'Medium' : 'Low',
      },
      update: { matchScore: fit },
    });

    findings.push({
      companyId: company.id,
      companyName: company.companyName,
      transactionStatus: company.transactionStatus,
      jobTitle: result.title,
      sourceUrl: result.url,
      sourceType: result.sourceType,
      location: result.location ?? null,
      requirements,
      estimatedFit: fit,
      isNewProspect: isNew || company.transactionStatus !== 'existing',
    });
  }

  await prisma.aiInteraction.create({
    data: {
      agentType: 'market_research',
      candidateId,
      question: `匿名プロフィールによる WEB 調査: ${anon.summary}`,
      structuredResult: toJson({ keywords, findings: findings.length }),
      provider: provider.name,
      confidence: findings.length > 0 ? 'Medium' : 'Low',
    },
  });

  return {
    anonymizedProfile: anon,
    query: keywords,
    provider: provider.name,
    findings,
    newProspectCount: findings.filter((f) => f.isNewProspect).length,
  };
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** 定期実行 (§52 毎週)。稼働候補者のうち上位ランクを対象に調査する。 */
export async function runWeeklyMarketResearch(maxCandidates = 20) {
  const candidates = await prisma.candidate.findMany({
    where: { status: 'active', rank: { in: ['S', 'A'] } },
    orderBy: { updatedAt: 'desc' },
    take: maxCandidates,
    select: { id: true },
  });

  let findings = 0;
  // 企業単位で数える (求人件数で数えると実態より多く見えるため)。
  const prospectCompanies = new Set<string>();
  for (const c of candidates) {
    const result = await researchForCandidate(c.id);
    findings += result.findings.length;
    for (const finding of result.findings) {
      if (finding.isNewProspect) prospectCompanies.add(finding.companyId);
    }
  }
  return { candidates: candidates.length, findings, newProspectCompanies: prospectCompanies.size };
}

/** 鮮度チェック: 一定期間確認されていない WEB 情報を stale にする (§14)。 */
export async function markStaleFindings(days = 30) {
  const threshold = new Date(Date.now() - days * 24 * 3600_000);
  const result = await prisma.webJobFinding.updateMany({
    where: { lastVerifiedAt: { lt: threshold }, activeStatus: 'active' },
    data: { activeStatus: 'stale' },
  });
  return { staled: result.count };
}
