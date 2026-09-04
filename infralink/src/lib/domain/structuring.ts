import { prisma } from '@/lib/db';
import { parseList } from '@/lib/json';
import { normalizeJobCategory } from './taxonomy';

/**
 * マッチング・検索・営業提案が共通で使う候補者プロフィール。
 * DB の正規化済みテーブルから組み立てる (§10 の構造化結果の読み出し側)。
 */

export type CandidateProfile = {
  id: string;
  name: string;
  age: number | null;
  location: string | null;
  currentSalary: number | null;
  desiredSalary: number | null;
  minimumSalary: number | null;
  jobChangeTiming: string | null;
  rank: string | null;
  phase: string;
  disclosureConsent: boolean;
  skills: string[];
  qualifications: string[];
  totalYearsExperience: number;
  /** 経験年数が最も長い (= 主たる) 経歴。 */
  primaryCareer: {
    companyName: string;
    industry: string | null;
    jobCategory: string | null;
    yearsExperience: number;
  } | null;
  industries: string[];
  jobCategories: string[];
  managementCount: number | null;
  preference: {
    desiredLocations: string[];
    desiredJobs: string[];
    acceptableJobs: string[];
    ngJobs: string[];
    transferAllowed: string | null;
    businessTripAllowed: string | null;
    nightShiftAllowed: string | null;
    priorities: string[];
  };
  /** 判断に不足している情報 (§38)。 */
  missingInfo: string[];
};

const candidateInclude = {
  careers: true,
  skills: true,
  qualifications: true,
  preference: true,
} as const;

type CandidateWithRelations = Awaited<
  ReturnType<typeof prisma.candidate.findFirst<{ include: typeof candidateInclude }>>
>;

export function buildProfile(candidate: NonNullable<CandidateWithRelations>): CandidateProfile {
  const careers = [...candidate.careers].sort(
    (a, b) => (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0),
  );
  const primary = careers[0] ?? null;
  const total = careers.reduce((sum, c) => sum + (c.yearsExperience ?? 0), 0);

  const preference = candidate.preference;
  const missingInfo: string[] = [];
  if (!preference?.transferAllowed || preference.transferAllowed === 'unknown') {
    missingInfo.push('転勤可否が不明');
  }
  if (!preference?.nightShiftAllowed || preference.nightShiftAllowed === 'unknown') {
    missingInfo.push('夜勤可否が不明');
  }
  if (!candidate.desiredSalary) missingInfo.push('希望年収が未取得');
  if (careers.length === 0) missingInfo.push('職務経歴が未登録');
  if (candidate.skills.length === 0) missingInfo.push('スキルが未抽出');
  if (candidate.skills.some((s) => s.skillName === 'PLC') && !candidate.skills.some((s) => s.evidence?.includes('メーカー'))) {
    missingInfo.push('PLC のメーカー (三菱 / オムロン等) が不明');
  }

  return {
    id: candidate.id,
    name: candidate.name,
    age: candidate.age,
    location: candidate.location,
    currentSalary: candidate.currentSalary,
    desiredSalary: candidate.desiredSalary,
    minimumSalary: preference?.minimumSalary ?? null,
    jobChangeTiming: candidate.jobChangeTiming,
    rank: candidate.rank,
    phase: candidate.phase,
    disclosureConsent: candidate.disclosureConsent,
    skills: candidate.skills.map((s) => s.skillName),
    qualifications: candidate.qualifications.map((q) => q.qualificationName),
    totalYearsExperience: total,
    primaryCareer: primary
      ? {
          companyName: primary.companyName,
          industry: primary.industry,
          jobCategory: normalizeJobCategory(primary.jobCategory),
          yearsExperience: primary.yearsExperience ?? 0,
        }
      : null,
    industries: [...new Set(careers.map((c) => c.industry).filter((v): v is string => Boolean(v)))],
    jobCategories: [
      ...new Set(
        careers
          .map((c) => normalizeJobCategory(c.jobCategory))
          .filter((v): v is string => Boolean(v)),
      ),
    ],
    managementCount: careers.reduce<number | null>(
      (max, c) => (c.managementCount && (max === null || c.managementCount > max) ? c.managementCount : max),
      null,
    ),
    preference: {
      desiredLocations: parseList(preference?.desiredLocations),
      desiredJobs: parseList(preference?.desiredJobs).map((j) => normalizeJobCategory(j) ?? j),
      acceptableJobs: parseList(preference?.acceptableJobs).map((j) => normalizeJobCategory(j) ?? j),
      ngJobs: parseList(preference?.ngJobs).map((j) => normalizeJobCategory(j) ?? j),
      transferAllowed: preference?.transferAllowed ?? null,
      businessTripAllowed: preference?.businessTripAllowed ?? null,
      nightShiftAllowed: preference?.nightShiftAllowed ?? null,
      priorities: [preference?.priority1, preference?.priority2, preference?.priority3].filter(
        (v): v is string => Boolean(v),
      ),
    },
    missingInfo,
  };
}

export async function loadProfile(candidateId: string): Promise<CandidateProfile | null> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: candidateInclude,
  });
  return candidate ? buildProfile(candidate) : null;
}

export async function loadProfiles(where: Record<string, unknown> = {}): Promise<CandidateProfile[]> {
  const candidates = await prisma.candidate.findMany({ where, include: candidateInclude });
  return candidates.map(buildProfile);
}

/** 求人側の判定用ビュー。 */
export type JobProfile = {
  id: string;
  companyId: string;
  companyName: string;
  jobTitle: string;
  jobCategory: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  qualifications: string[];
  requiredExperience: string | null;
  industry: string | null;
  description: string | null;
};

export function buildJobProfile(job: {
  id: string;
  companyId: string;
  jobTitle: string;
  jobCategory: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  requiredSkills: string | null;
  preferredSkills: string | null;
  qualifications: string | null;
  requiredExperience: string | null;
  description: string | null;
  company: { companyName: string; industry: string | null };
}): JobProfile {
  return {
    id: job.id,
    companyId: job.companyId,
    companyName: job.company.companyName,
    jobTitle: job.jobTitle,
    jobCategory: normalizeJobCategory(job.jobCategory),
    location: job.location,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    requiredSkills: parseList(job.requiredSkills),
    preferredSkills: parseList(job.preferredSkills),
    qualifications: parseList(job.qualifications),
    requiredExperience: job.requiredExperience,
    industry: job.company.industry,
    description: job.description,
  };
}
