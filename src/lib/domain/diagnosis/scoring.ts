import type { DiagnosisConfig } from "@/lib/config/settings";
import {
  EXPERIENCE_BANDS,
  type CandidateProfile,
  type ConfidenceLevel,
  type EducationLevel,
  type ExperienceBand,
  type MatchRank,
  type OccupationMaster,
  type OccupationRequirementLink,
  type SalaryBenchmark,
  type ScoreBreakdown,
  type TransitionRule,
} from "./types";

const EDUCATION_RANK: Record<EducationLevel, number> = {
  other: 1,
  high_school: 1,
  vocational: 2,
  associate: 3,
  bachelor: 4,
  master: 5,
  doctorate: 6,
};

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roundDownTo(value: number, unit: number): number {
  return Math.floor(value / unit) * unit;
}

export function roundUpTo(value: number, unit: number): number {
  return Math.ceil(value / unit) * unit;
}

export function experienceBandFor(years: number): ExperienceBand {
  if (years <= 2) return "0-2";
  if (years <= 5) return "3-5";
  if (years <= 9) return "6-9";
  if (years <= 14) return "10-14";
  return "15+";
}

/* -------------------------------------------------------------------------- */
/* Match components — each returns 0..1                                       */
/* -------------------------------------------------------------------------- */

/**
 * Share of the target occupation's skill importance that the candidate covers.
 * Preferred skills from the transition rule are folded in with a nominal
 * weight so that rule-specific signals still move the score.
 */
export function computeSkillMatch(
  candidateSkillIds: readonly number[],
  occupationSkills: readonly OccupationRequirementLink[],
  preferredSkillIds: readonly number[],
  neutral: number,
): number {
  const owned = new Set(candidateSkillIds);
  const weighted = new Map<number, number>();

  for (const link of occupationSkills) {
    weighted.set(link.id, Math.max(weighted.get(link.id) ?? 0, link.weight));
  }
  for (const id of preferredSkillIds) {
    weighted.set(id, Math.max(weighted.get(id) ?? 0, 0.5));
  }

  if (weighted.size === 0) return neutral;

  let total = 0;
  let matched = 0;
  for (const [skillId, weight] of weighted) {
    total += weight;
    if (owned.has(skillId)) matched += weight;
  }
  return total === 0 ? neutral : clamp01(matched / total);
}

export function computeCertificationMatch(
  candidateCertificationIds: readonly number[],
  occupationCertifications: readonly OccupationRequirementLink[],
  preferredCertificationIds: readonly number[],
  neutral: number,
): number {
  return computeSkillMatch(
    candidateCertificationIds,
    occupationCertifications,
    preferredCertificationIds,
    neutral,
  );
}

/**
 * Below the rule's minimum the score degrades linearly; above it the score
 * grows towards 1 as experience approaches the saturation point.
 */
export function computeExperienceMatch(
  experienceYears: number,
  minimumExperienceYears: number,
  saturationYears: number,
): number {
  if (experienceYears <= 0) return 0;
  if (minimumExperienceYears > 0 && experienceYears < minimumExperienceYears) {
    return clamp01((experienceYears / minimumExperienceYears) * 0.7);
  }
  const target = Math.max(minimumExperienceYears, saturationYears);
  return clamp01(0.7 + 0.3 * clamp01(experienceYears / target));
}

export function computeLocationMatch(
  benchmarkRegionId: number | null,
  profile: Pick<CandidateProfile, "currentRegionId" | "desiredRegionIds" | "relocationOk">,
): number {
  const desired = new Set(profile.desiredRegionIds);
  if (desired.size === 0) desired.add(profile.currentRegionId);

  if (benchmarkRegionId === null) return profile.relocationOk ? 0.8 : 0.7;
  if (desired.has(benchmarkRegionId)) return 1;
  if (benchmarkRegionId === profile.currentRegionId) return 0.8;
  return profile.relocationOk ? 0.6 : 0.3;
}

/** Share of the occupation's hard working conditions the candidate accepts. */
export function computeWorkingConditionMatch(
  occupation: Pick<
    OccupationMaster,
    "requiresTravel" | "requiresNightShift" | "requiresRelocation"
  >,
  profile: Pick<CandidateProfile, "travelOk" | "nightShiftOk" | "relocationOk">,
): number {
  const checks: boolean[] = [];
  if (occupation.requiresTravel) checks.push(profile.travelOk);
  if (occupation.requiresNightShift) checks.push(profile.nightShiftOk);
  if (occupation.requiresRelocation) checks.push(profile.relocationOk);
  if (checks.length === 0) return 1;
  return clamp01(checks.filter(Boolean).length / checks.length);
}

/** Education fit and management experience, averaged. */
export function computeProfileMatch(
  occupation: Pick<OccupationMaster, "minEducationLevel" | "managementRelevant">,
  profile: Pick<CandidateProfile, "educationLevel" | "managementYears">,
  config: Pick<DiagnosisConfig, "managementSaturationYears" | "neutralComponentScore">,
): number {
  let education = 1;
  if (occupation.minEducationLevel) {
    if (!profile.educationLevel) {
      education = config.neutralComponentScore;
    } else {
      const gap =
        EDUCATION_RANK[profile.educationLevel] -
        EDUCATION_RANK[occupation.minEducationLevel];
      education = gap >= 0 ? 1 : gap === -1 ? 0.5 : 0;
    }
  }

  const management = occupation.managementRelevant
    ? clamp01(profile.managementYears / config.managementSaturationYears)
    : 1;

  return clamp01((education + management) / 2);
}

/* -------------------------------------------------------------------------- */
/* Aggregate score                                                            */
/* -------------------------------------------------------------------------- */

export interface ScoreOccupationInput {
  profile: CandidateProfile;
  occupation: OccupationMaster;
  rule: TransitionRule | null;
  benchmark: SalaryBenchmark | null;
  config: DiagnosisConfig;
}

export interface ScoreOccupationOutput {
  matchScore: number;
  breakdown: ScoreBreakdown;
  unmetRequirements: { skillIds: number[]; certificationIds: number[] };
}

export function scoreOccupation({
  profile,
  occupation,
  rule,
  benchmark,
  config,
}: ScoreOccupationInput): ScoreOccupationOutput {
  const { weights, neutralComponentScore } = config;

  const skill = computeSkillMatch(
    profile.skillIds,
    occupation.skills,
    rule?.preferredSkillIds ?? [],
    neutralComponentScore,
  );
  const certification = computeCertificationMatch(
    profile.certificationIds,
    occupation.certifications,
    rule?.preferredCertificationIds ?? [],
    neutralComponentScore,
  );
  const experience = computeExperienceMatch(
    profile.experienceYears,
    rule?.minimumExperienceYears ?? 0,
    config.experienceSaturationYears,
  );
  const location = computeLocationMatch(benchmark?.regionId ?? null, profile);
  const workingCondition = computeWorkingConditionMatch(occupation, profile);
  const profileFit = computeProfileMatch(occupation, profile, config);

  const totalWeight =
    weights.skill +
    weights.certification +
    weights.experience +
    weights.location +
    weights.workingCondition +
    weights.profile;

  const weightedSubtotal =
    totalWeight === 0
      ? 0
      : (skill * weights.skill +
          certification * weights.certification +
          experience * weights.experience +
          location * weights.location +
          workingCondition * weights.workingCondition +
          profileFit * weights.profile) /
        totalWeight;

  /* Transition plausibility scales the whole score between the floor and 1. */
  const base = rule ? clamp01(rule.baseTransitionScore / 100) : 1;
  const transitionFactor =
    config.transitionFactorFloor + (1 - config.transitionFactorFloor) * base;

  const ownedSkills = new Set(profile.skillIds);
  const ownedCertifications = new Set(profile.certificationIds);
  const unmetSkillIds = (rule?.requiredSkillIds ?? []).filter(
    (id) => !ownedSkills.has(id),
  );
  const unmetCertificationIds = (rule?.requiredCertificationIds ?? []).filter(
    (id) => !ownedCertifications.has(id),
  );
  const requirementPenalty =
    (unmetSkillIds.length + unmetCertificationIds.length) * config.requirementPenalty;

  const raw = weightedSubtotal * transitionFactor * 100 - requirementPenalty;
  const matchScore = Math.round(Math.min(100, Math.max(0, raw)));

  return {
    matchScore,
    breakdown: {
      skill: round3(skill),
      certification: round3(certification),
      experience: round3(experience),
      location: round3(location),
      workingCondition: round3(workingCondition),
      profile: round3(profileFit),
      weightedSubtotal: round3(weightedSubtotal),
      transitionFactor: round3(transitionFactor),
      requirementPenalty,
      final: matchScore,
    },
    unmetRequirements: {
      skillIds: unmetSkillIds,
      certificationIds: unmetCertificationIds,
    },
  };
}

export function rankFromScore(
  score: number,
  thresholds: DiagnosisConfig["rankThresholds"],
): MatchRank {
  if (score >= thresholds.S) return "S";
  if (score >= thresholds.A) return "A";
  if (score >= thresholds.B) return "B";
  return "C";
}

/* -------------------------------------------------------------------------- */
/* Benchmark selection                                                        */
/* -------------------------------------------------------------------------- */

function bandDistance(a: ExperienceBand, b: ExperienceBand): number {
  return Math.abs(EXPERIENCE_BANDS.indexOf(a) - EXPERIENCE_BANDS.indexOf(b));
}

/**
 * Picks the most specific benchmark available: preferred region first, then a
 * region-agnostic (national) row, preferring an exact experience band and a
 * matching or unspecified education level.
 */
export function selectBenchmark(
  benchmarks: readonly SalaryBenchmark[],
  occupationId: number,
  preferredRegionIds: readonly number[],
  experienceBand: ExperienceBand,
  educationLevel: EducationLevel | null,
): SalaryBenchmark | null {
  const candidates = benchmarks.filter((b) => b.occupationId === occupationId);
  if (candidates.length === 0) return null;

  let best: SalaryBenchmark | null = null;
  let bestScore = -Infinity;

  for (const benchmark of candidates) {
    let score = 0;

    if (benchmark.regionId === null) {
      score += 2;
    } else {
      const index = preferredRegionIds.indexOf(benchmark.regionId);
      if (index === -1) continue;
      score += 8 - index;
    }

    score += Math.max(0, 6 - bandDistance(benchmark.experienceBand, experienceBand) * 3);

    if (benchmark.educationLevel === null) score += 1;
    else if (benchmark.educationLevel === educationLevel) score += 3;
    else continue;

    score += CONFIDENCE_RANK[benchmark.confidenceLevel] * 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = benchmark;
    }
  }

  return best;
}

export function benchmarkConfidence(
  benchmarks: readonly (SalaryBenchmark | null)[],
): ConfidenceLevel {
  const present = benchmarks.filter((b): b is SalaryBenchmark => b !== null);
  if (present.length === 0) return "low";
  const worst = Math.min(...present.map((b) => CONFIDENCE_RANK[b.confidenceLevel]));
  return worst >= 3 ? "high" : worst === 2 ? "medium" : "low";
}

/* -------------------------------------------------------------------------- */
/* Salary projection                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Candidate-specific band for one occupation. A perfect match reaches the
 * median..high part of the market band; a weak match sits at low..median.
 */
export function expectedSalaryForMatch(
  benchmark: SalaryBenchmark,
  matchScore: number,
): { low: number; high: number } {
  const fit = clamp01(matchScore / 100);
  return {
    low: benchmark.salaryLow + (benchmark.salaryMedian - benchmark.salaryLow) * fit,
    high: benchmark.salaryMedian + (benchmark.salaryHigh - benchmark.salaryMedian) * fit,
  };
}

export interface SalaryProjectionInput {
  low: number;
  high: number;
  matchScore: number;
}

/**
 * Score-weighted average across the strongest options, then rounded outward to
 * the configured display unit so we never imply false precision.
 */
export function projectSalaryRange(
  options: readonly SalaryProjectionInput[],
  unit: number,
): { low: number; high: number } | null {
  if (options.length === 0) return null;

  const totalWeight = options.reduce((sum, option) => sum + option.matchScore, 0);
  if (totalWeight <= 0) return null;

  const low =
    options.reduce((sum, option) => sum + option.low * option.matchScore, 0) / totalWeight;
  const high =
    options.reduce((sum, option) => sum + option.high * option.matchScore, 0) /
    totalWeight;

  const roundedLow = roundDownTo(low, unit);
  const roundedHigh = Math.max(roundUpTo(high, unit), roundedLow + unit);
  return { low: roundedLow, high: roundedHigh };
}
