import type { DiagnosisConfig } from "@/lib/config/settings";
import {
  benchmarkConfidence,
  expectedSalaryForMatch,
  projectSalaryRange,
  rankFromScore,
  roundUpTo,
  scoreOccupation,
  selectBenchmark,
} from "./scoring";
import type {
  CandidateProfile,
  DiagnosisResult,
  OccupationMaster,
  OccupationMatch,
  SalaryBenchmark,
  TransitionRule,
} from "./types";

export interface DiagnosisMasterData {
  occupations: ReadonlyMap<number, OccupationMaster>;
  transitionRules: readonly TransitionRule[];
  benchmarks: readonly SalaryBenchmark[];
  skillNames: ReadonlyMap<number, string>;
  certificationNames: ReadonlyMap<number, string>;
}

export class DiagnosisInputError extends Error {}

/**
 * Deterministic, explainable career-routing diagnosis.
 *
 * The engine is intentionally free of I/O and of any statistical model: every
 * number it produces can be traced back to master data plus the weights in
 * `DiagnosisConfig`, which is what makes the result defensible to a candidate
 * and, later, replaceable by a trained model without changing callers.
 */
export function runDiagnosis(
  profile: CandidateProfile,
  master: DiagnosisMasterData,
  config: DiagnosisConfig,
): DiagnosisResult {
  const currentOccupation = master.occupations.get(profile.currentOccupationId);
  if (!currentOccupation) {
    throw new DiagnosisInputError(
      `unknown occupation: ${String(profile.currentOccupationId)}`,
    );
  }

  const preferredRegionIds = dedupe([
    ...profile.desiredRegionIds,
    profile.currentRegionId,
  ]);

  /* 1. Current occupation: market salary and baseline fit. */
  const currentBenchmark = selectBenchmark(
    master.benchmarks,
    currentOccupation.id,
    preferredRegionIds,
    profile.experienceBand,
    profile.educationLevel,
  );
  const currentScored = scoreOccupation({
    profile,
    occupation: currentOccupation,
    rule: null,
    benchmark: currentBenchmark,
    config,
  });
  const currentMatch = toMatch(
    currentOccupation,
    true,
    currentScored,
    null,
    currentBenchmark,
  );

  /* 2-4. Explore adjacent occupations through the transition rules. */
  const targetMatches: OccupationMatch[] = [];
  for (const rule of master.transitionRules) {
    if (rule.sourceOccupationId !== currentOccupation.id) continue;
    if (rule.targetOccupationId === currentOccupation.id) continue;

    const target = master.occupations.get(rule.targetOccupationId);
    if (!target) continue;

    const benchmark = selectBenchmark(
      master.benchmarks,
      target.id,
      preferredRegionIds,
      profile.experienceBand,
      profile.educationLevel,
    );
    const scored = scoreOccupation({ profile, occupation: target, rule, benchmark, config });
    targetMatches.push(toMatch(target, false, scored, rule.id, benchmark));
  }

  targetMatches.sort((a, b) => b.matchScore - a.matchScore);

  const careerOptions = targetMatches
    .filter((match) => match.matchScore >= config.minMatchScore)
    .slice(0, config.maxCareerOptions);

  /* 5-7. Salary projection over the strongest options. */
  const projectionSource = (careerOptions.length > 0 ? careerOptions : [currentMatch])
    .filter((match) => match.expectedSalaryLow !== null)
    .slice(0, config.salaryOptionCount)
    .map((match) => ({
      low: match.expectedSalaryLow as number,
      high: match.expectedSalaryHigh as number,
      matchScore: Math.max(match.matchScore, 1),
    }));

  const projected = capProjection(
    projectSalaryRange(projectionSource, config.salaryRoundingUnit),
    profile.currentSalaryYen,
    config,
  );

  /*
   * Market value rank reflects how transferable the candidate is, not how well
   * they fit the job they already hold — otherwise everyone who is competent at
   * their current job would score S and the rank would carry no information.
   */
  const bestMatchScore =
    targetMatches.length > 0
      ? Math.max(...targetMatches.map((match) => match.matchScore))
      : currentMatch.matchScore;

  return {
    engineVersion: config.engineVersion,
    currentOccupationId: currentOccupation.id,
    currentSalaryYen: profile.currentSalaryYen,
    currentMarket: currentBenchmark
      ? {
          low: currentBenchmark.salaryLow,
          median: currentBenchmark.salaryMedian,
          high: currentBenchmark.salaryHigh,
        }
      : null,
    estimatedSalaryLow: projected?.low ?? null,
    estimatedSalaryHigh: projected?.high ?? null,
    upliftLow: projected ? projected.low - profile.currentSalaryYen : null,
    upliftHigh: projected ? projected.high - profile.currentSalaryYen : null,
    bestMatchScore,
    matchRank: rankFromScore(bestMatchScore, config.rankThresholds),
    dataConfidence: benchmarkConfidence([
      currentBenchmark,
      ...careerOptions.map((option) => option.benchmark),
    ]),
    matches: [currentMatch, ...targetMatches],
    careerOptions,
    valuedExperiences: collectValuedExperiences(
      profile,
      [currentOccupation, ...careerOptions.map((o) => master.occupations.get(o.occupationId))],
      master,
      config.valuedExperienceCount,
    ),
  };
}

/**
 * Keeps the headline range inside a defensible multiple of what the candidate
 * earns today, while never pulling the range below the market floor itself.
 */
function capProjection(
  projected: { low: number; high: number } | null,
  currentSalaryYen: number,
  config: DiagnosisConfig,
): { low: number; high: number } | null {
  if (!projected || currentSalaryYen <= 0) return projected;

  const ceiling = roundUpTo(
    currentSalaryYen * config.maxUpliftFactor,
    config.salaryRoundingUnit,
  );
  if (projected.high <= ceiling) return projected;

  const high = Math.max(ceiling, projected.low + config.salaryRoundingUnit);
  return { low: Math.min(projected.low, high - config.salaryRoundingUnit), high };
}

function toMatch(
  occupation: OccupationMaster,
  isCurrent: boolean,
  scored: ReturnType<typeof scoreOccupation>,
  transitionRuleId: number | null,
  benchmark: SalaryBenchmark | null,
): OccupationMatch {
  const expected = benchmark ? expectedSalaryForMatch(benchmark, scored.matchScore) : null;
  return {
    occupationId: occupation.id,
    occupationName: occupation.name,
    isCurrent,
    matchScore: scored.matchScore,
    breakdown: scored.breakdown,
    unmetRequirements: scored.unmetRequirements,
    transitionRuleId,
    benchmark,
    expectedSalaryLow: expected ? Math.round(expected.low) : null,
    expectedSalaryHigh: expected ? Math.round(expected.high) : null,
  };
}

/**
 * The candidate's own skills and certifications, ranked by how much the
 * relevant occupations value them. This is what the result screen shows as
 * "評価されやすい経験".
 */
function collectValuedExperiences(
  profile: CandidateProfile,
  occupations: readonly (OccupationMaster | undefined)[],
  master: DiagnosisMasterData,
  limit: number,
): string[] {
  const skillWeight = new Map<number, number>();
  const certificationWeight = new Map<number, number>();
  const ownedSkills = new Set(profile.skillIds);
  const ownedCertifications = new Set(profile.certificationIds);

  for (const occupation of occupations) {
    if (!occupation) continue;
    for (const link of occupation.skills) {
      if (!ownedSkills.has(link.id)) continue;
      skillWeight.set(link.id, (skillWeight.get(link.id) ?? 0) + link.weight);
    }
    for (const link of occupation.certifications) {
      if (!ownedCertifications.has(link.id)) continue;
      certificationWeight.set(
        link.id,
        (certificationWeight.get(link.id) ?? 0) + link.weight,
      );
    }
  }

  const entries: { name: string; weight: number }[] = [];
  for (const [id, weight] of skillWeight) {
    const name = master.skillNames.get(id);
    if (name) entries.push({ name, weight });
  }
  for (const [id, weight] of certificationWeight) {
    const name = master.certificationNames.get(id);
    /* Certifications are scarcer signals, so they outrank equal-weight skills. */
    if (name) entries.push({ name, weight: weight + 0.1 });
  }

  return entries
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => entry.name);
}

function dedupe(values: readonly number[]): number[] {
  return [...new Set(values)];
}
