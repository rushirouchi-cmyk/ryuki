import {
  DEFAULT_DIAGNOSIS_CONFIG,
  DIAGNOSIS_ENGINE_VERSION,
  type DiagnosisConfig,
} from '@/domain/config/diagnosis-config';
import type {
  CertificationRef,
  DiagnosisInput,
  DiagnosisMasters,
  DiagnosisResult,
  ExperienceBand,
  MatchBreakdown,
  OccupationOption,
  OccupationRef,
  SalaryBenchmark,
  SkillRef,
  TransitionRule,
  ValueRank,
} from './types';

const EXPERIENCE_BANDS: { band: ExperienceBand; min: number; max: number }[] = [
  { band: '0-2', min: 0, max: 2 },
  { band: '3-5', min: 3, max: 5 },
  { band: '6-9', min: 6, max: 9 },
  { band: '10-14', min: 10, max: 14 },
  { band: '15+', min: 15, max: Number.POSITIVE_INFINITY },
];

/** Score above which the expected salary is interpolated toward the market high. */
const MEDIAN_ANCHOR_SCORE = 70;
/** Score below which the expected salary sits at the market low. */
const LOW_ANCHOR_SCORE = 40;

export function toExperienceBand(years: number): ExperienceBand {
  const safeYears = Number.isFinite(years) ? Math.max(0, years) : 0;
  const found = EXPERIENCE_BANDS.find((b) => safeYears >= b.min && safeYears <= b.max);
  return found?.band ?? '15+';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundDownTo(value: number, unit: number): number {
  return Math.floor(value / unit) * unit;
}

export function roundUpTo(value: number, unit: number): number {
  return Math.ceil(value / unit) * unit;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function coverage(required: string[], held: Set<string>): number {
  if (required.length === 0) return 1;
  const hit = required.filter((id) => held.has(id)).length;
  return hit / required.length;
}

/* --------------------------------------------------------- component scores */

export function skillMatchRatio(params: {
  occupationSkills: { skillId: string; importanceWeight: number }[];
  requiredSkillIds: string[];
  preferredSkillIds: string[];
  heldSkillIds: Set<string>;
}): number {
  const { occupationSkills, requiredSkillIds, preferredSkillIds, heldSkillIds } = params;
  const totalWeight = occupationSkills.reduce((sum, s) => sum + s.importanceWeight, 0);
  const heldWeight = occupationSkills
    .filter((s) => heldSkillIds.has(s.skillId))
    .reduce((sum, s) => sum + s.importanceWeight, 0);
  const base = totalWeight > 0 ? ratio(heldWeight, totalWeight) : 0;
  const required = coverage(requiredSkillIds, heldSkillIds);
  const preferred = preferredSkillIds.length > 0 ? coverage(preferredSkillIds, heldSkillIds) : base;
  return clamp(0.6 * base + 0.3 * required + 0.1 * preferred, 0, 1);
}

export function certificationMatchRatio(params: {
  /** certifications that matter for the target occupation, with 0-1 weights */
  occupationCertifications: { certificationId: string; importanceWeight: number }[];
  requiredCertificationIds: string[];
  preferredCertificationIds: string[];
  heldCertificationIds: Set<string>;
}): number {
  const {
    occupationCertifications,
    requiredCertificationIds,
    preferredCertificationIds,
    heldCertificationIds,
  } = params;

  const totalWeight = occupationCertifications.reduce((sum, c) => sum + c.importanceWeight, 0);
  const heldWeight = occupationCertifications
    .filter((c) => heldCertificationIds.has(c.certificationId))
    .reduce((sum, c) => sum + c.importanceWeight, 0);
  // Occupations with no certification culture score a neutral 0.5 rather than 0,
  // so people in unlicensed trades are not punished for something irrelevant.
  const base = totalWeight > 0 ? ratio(heldWeight, totalWeight) : 0.5;

  const hasRuleRequirement = requiredCertificationIds.length + preferredCertificationIds.length > 0;
  if (!hasRuleRequirement) return clamp(base, 0, 1);

  const required = coverage(requiredCertificationIds, heldCertificationIds);
  const preferred =
    preferredCertificationIds.length > 0 ? coverage(preferredCertificationIds, heldCertificationIds) : required;
  return clamp(0.5 * base + 0.35 * required + 0.15 * preferred, 0, 1);
}

export function experienceMatchRatio(params: {
  years: number;
  minimumYears: number;
  fullBonusYears: number;
}): number {
  const { years, minimumYears, fullBonusYears } = params;
  if (years >= minimumYears) {
    const surplus = years - minimumYears;
    return clamp(0.6 + 0.4 * clamp(ratio(surplus, fullBonusYears), 0, 1), 0, 1);
  }
  if (minimumYears <= 0) return 0.7;
  return clamp(0.7 * ratio(years, minimumYears), 0, 1);
}

export function locationMatchRatio(params: {
  currentPrefecture: string;
  desiredPrefectures: string[];
  relocationOk: boolean;
  requiresRelocation: boolean;
}): number {
  const { currentPrefecture, desiredPrefectures, relocationOk, requiresRelocation } = params;
  const staysLocal = desiredPrefectures.includes(currentPrefecture);
  if (requiresRelocation) return relocationOk ? 0.9 : 0.2;
  if (staysLocal) return 1;
  return relocationOk ? 0.8 : 0.3;
}

export function workingConditionMatchRatio(params: {
  requiresRelocation: boolean;
  requiresBusinessTrip: boolean;
  requiresNightShift: boolean;
  relocationOk: boolean;
  businessTripOk: boolean;
  nightShiftOk: boolean;
}): number {
  const checks: boolean[] = [];
  if (params.requiresRelocation) checks.push(params.relocationOk);
  if (params.requiresBusinessTrip) checks.push(params.businessTripOk);
  if (params.requiresNightShift) checks.push(params.nightShiftOk);
  if (checks.length === 0) return 1;
  return checks.filter(Boolean).length / checks.length;
}

export function educationManagementRatio(params: {
  educationScore: number;
  hasManagementExperience: boolean;
}): number {
  const management = params.hasManagementExperience ? 1 : 0.4;
  return clamp(0.5 * params.educationScore + 0.5 * management, 0, 1);
}

/* ------------------------------------------------------------- benchmarks */

/**
 * Resolves a benchmark with a documented fallback chain:
 * exact education -> education-agnostic -> national fallback region.
 */
export function findBenchmark(
  benchmarks: SalaryBenchmark[],
  params: {
    occupationId: string;
    regionId: string | null;
    nationalRegionId: string | null;
    experienceBand: ExperienceBand;
    educationLevel: string;
  },
): SalaryBenchmark | null {
  const forOccupation = benchmarks.filter(
    (b) => b.occupationId === params.occupationId && b.experienceBand === params.experienceBand,
  );
  const regionOrder = [params.regionId, params.nationalRegionId].filter(
    (id): id is string => typeof id === 'string',
  );
  for (const regionId of regionOrder) {
    const inRegion = forOccupation.filter((b) => b.regionId === regionId);
    const exact = inRegion.find((b) => b.educationLevel === params.educationLevel);
    if (exact) return exact;
    const agnostic = inRegion.find((b) => b.educationLevel === null);
    if (agnostic) return agnostic;
    if (inRegion[0]) return inRegion[0];
  }
  return null;
}

/**
 * Interpolates a point estimate inside [low, median, high] from the match score.
 * Below LOW_ANCHOR_SCORE the estimate sits on the market low; at
 * MEDIAN_ANCHOR_SCORE it sits on the median; at 100 it reaches the high.
 */
export function expectedSalaryFor(benchmark: SalaryBenchmark, matchScore: number): number {
  const { salaryLow, salaryMedian, salaryHigh } = benchmark;
  if (matchScore >= MEDIAN_ANCHOR_SCORE) {
    const t = clamp((matchScore - MEDIAN_ANCHOR_SCORE) / (100 - MEDIAN_ANCHOR_SCORE), 0, 1);
    return salaryMedian + (salaryHigh - salaryMedian) * t;
  }
  const t = clamp((matchScore - LOW_ANCHOR_SCORE) / (MEDIAN_ANCHOR_SCORE - LOW_ANCHOR_SCORE), 0, 1);
  return salaryLow + (salaryMedian - salaryLow) * t;
}

export function rankFromScore(score: number, thresholds: { S: number; A: number; B: number }): ValueRank {
  if (score >= thresholds.S) return 'S';
  if (score >= thresholds.A) return 'A';
  if (score >= thresholds.B) return 'B';
  return 'C';
}

/* ------------------------------------------------------------ main engine */

interface ScoredTarget {
  occupation: OccupationRef;
  rule: TransitionRule | null;
  isCurrent: boolean;
}

export function runDiagnosis(
  input: DiagnosisInput,
  masters: DiagnosisMasters,
  config: DiagnosisConfig = DEFAULT_DIAGNOSIS_CONFIG,
): DiagnosisResult {
  const warnings: string[] = [];
  const occupationById = new Map(masters.occupations.map((o) => [o.id, o]));
  const skillById = new Map(masters.skills.map((s) => [s.id, s]));
  const certById = new Map(masters.certifications.map((c) => [c.id, c]));
  const heldSkills = new Set(input.skillIds);
  const heldCerts = new Set(input.certificationIds);

  const currentOccupation = occupationById.get(input.currentOccupationId);
  if (!currentOccupation) {
    throw new Error(`Unknown occupation: ${input.currentOccupationId}`);
  }

  const experienceBand = toExperienceBand(input.experienceYears);
  const nationalRegion = masters.regions.find((r) => r.isNationalFallback) ?? null;
  const currentRegion =
    masters.regions.find((r) => r.prefecture === input.currentPrefecture && !r.isNationalFallback) ?? null;
  const targetPrefecture = input.desiredPrefectures[0] ?? input.currentPrefecture;
  const targetRegion =
    masters.regions.find((r) => r.prefecture === targetPrefecture && !r.isNationalFallback) ??
    currentRegion ??
    nationalRegion;

  if (!currentRegion && !nationalRegion) {
    warnings.push('地域の市場データが未整備のため、推定精度が低くなっています。');
  }

  const rules = masters.transitionRules.filter((r) => r.sourceOccupationId === currentOccupation.id);
  const targets: ScoredTarget[] = [{ occupation: currentOccupation, rule: null, isCurrent: true }];
  for (const rule of rules) {
    const occ = occupationById.get(rule.targetOccupationId);
    if (occ && occ.id !== currentOccupation.id) {
      targets.push({ occupation: occ, rule, isCurrent: false });
    }
  }

  const weights = config.weights;
  const weightTotal =
    weights.skill +
    weights.certification +
    weights.experience +
    weights.location +
    weights.workingCondition +
    weights.educationManagement;

  const options: OccupationOption[] = targets.map(({ occupation, rule, isCurrent }) => {
    const occSkills = masters.occupationSkills
      .filter((os) => os.occupationId === occupation.id)
      .map((os) => ({ skillId: os.skillId, importanceWeight: os.importanceWeight }));

    const requiredSkillIds = rule?.requiredSkillIds ?? [];
    const preferredSkillIds = rule?.preferredSkillIds ?? [];
    const requiredCertificationIds = rule?.requiredCertificationIds ?? [];
    const preferredCertificationIds = rule?.preferredCertificationIds ?? [];

    const skillRatio = skillMatchRatio({
      occupationSkills: occSkills,
      requiredSkillIds,
      preferredSkillIds,
      heldSkillIds: heldSkills,
    });
    const certRatio = certificationMatchRatio({
      occupationCertifications: masters.occupationCertifications
        .filter((oc) => oc.occupationId === occupation.id)
        .map((oc) => ({ certificationId: oc.certificationId, importanceWeight: oc.importanceWeight })),
      requiredCertificationIds,
      preferredCertificationIds,
      heldCertificationIds: heldCerts,
    });
    const expRatio = experienceMatchRatio({
      years: input.experienceYears,
      minimumYears: rule?.minimumExperienceYears ?? 0,
      fullBonusYears: config.experienceFullBonusYears,
    });
    const locRatio = locationMatchRatio({
      currentPrefecture: input.currentPrefecture,
      desiredPrefectures: input.desiredPrefectures,
      relocationOk: input.relocationOk,
      requiresRelocation: rule?.requiresRelocation ?? false,
    });
    const condRatio = workingConditionMatchRatio({
      requiresRelocation: rule?.requiresRelocation ?? false,
      requiresBusinessTrip: rule?.requiresBusinessTrip ?? false,
      requiresNightShift: rule?.requiresNightShift ?? false,
      relocationOk: input.relocationOk,
      businessTripOk: input.businessTripOk,
      nightShiftOk: input.nightShiftOk,
    });
    const eduRatio = educationManagementRatio({
      educationScore: config.educationScores[input.educationLevel] ?? 0.6,
      hasManagementExperience: input.hasManagementExperience,
    });

    const componentScore =
      weightTotal > 0
        ? ((skillRatio * weights.skill +
            certRatio * weights.certification +
            expRatio * weights.experience +
            locRatio * weights.location +
            condRatio * weights.workingCondition +
            eduRatio * weights.educationManagement) /
            weightTotal) *
          100
        : 0;

    const affinity = isCurrent ? 100 : (rule?.baseTransitionScore ?? 50);
    const affinityWeight = config.transitionAffinityWeight;
    const matchScore = Math.round(clamp((1 - affinityWeight) * componentScore + affinityWeight * affinity, 0, 100));

    const breakdown: MatchBreakdown = {
      skill: Math.round(skillRatio * weights.skill * 10) / 10,
      certification: Math.round(certRatio * weights.certification * 10) / 10,
      experience: Math.round(expRatio * weights.experience * 10) / 10,
      location: Math.round(locRatio * weights.location * 10) / 10,
      workingCondition: Math.round(condRatio * weights.workingCondition * 10) / 10,
      educationManagement: Math.round(eduRatio * weights.educationManagement * 10) / 10,
      transitionAffinity: affinity,
      componentScore: Math.round(componentScore * 10) / 10,
    };

    const benchmark = findBenchmark(masters.benchmarks, {
      occupationId: occupation.id,
      regionId: targetRegion?.id ?? null,
      nationalRegionId: nationalRegion?.id ?? null,
      experienceBand,
      educationLevel: input.educationLevel,
    });
    // Moving into a new occupation costs tenure, so its estimate is discounted.
    const discount = isCurrent ? 1 : config.crossOccupationDiscount;
    const expectedSalary = benchmark
      ? Math.round(expectedSalaryFor(benchmark, matchScore) * discount)
      : null;

    return {
      occupationId: occupation.id,
      occupationName: occupation.name,
      occupationCategory: occupation.category,
      isCurrentOccupation: isCurrent,
      matchScore,
      breakdown,
      benchmark,
      expectedSalary,
      expectedUpside: expectedSalary === null ? null : expectedSalary - input.currentSalary,
      matchedSkillIds: occSkills.filter((s) => heldSkills.has(s.skillId)).map((s) => s.skillId),
      missingRequiredSkillIds: requiredSkillIds.filter((id) => !heldSkills.has(id)),
      matchedCertificationIds: [...requiredCertificationIds, ...preferredCertificationIds].filter((id) =>
        heldCerts.has(id),
      ),
      notes: rule?.notes ?? null,
    };
  });

  const sorted = [...options].sort((a, b) => b.matchScore - a.matchScore);
  const qualifying = sorted.filter((o) => o.matchScore >= config.minMatchScore);
  const shown = (qualifying.length >= config.minOptionsShown ? qualifying : sorted.slice(0, config.minOptionsShown))
    .slice(0, config.maxOptionsShown);

  const withBenchmark = shown.filter(
    (o): o is OccupationOption & { benchmark: SalaryBenchmark; expectedSalary: number } =>
      o.benchmark !== null && o.expectedSalary !== null,
  );

  if (withBenchmark.length === 0) {
    warnings.push('市場年収データが不足しているため、推定レンジを表示できません。');
  }

  const unit = config.salaryRoundingUnit;
  const rawLow = withBenchmark.length
    ? Math.min(...withBenchmark.map((o) => (o.benchmark.salaryLow + o.expectedSalary) / 2))
    : input.currentSalary;
  const rawHigh = withBenchmark.length
    ? Math.max(...withBenchmark.map((o) => o.expectedSalary))
    : input.currentSalary;

  // Conservatism guard: never headline more than `maxUpliftMultiple` of what
  // the candidate earns today, however wide the benchmark spread happens to be.
  const cappedHigh = Math.min(rawHigh, input.currentSalary * config.maxUpliftMultiple);

  const estimatedSalaryHigh = roundUpTo(cappedHigh, unit);
  let estimatedSalaryLow = roundDownTo(Math.min(rawLow, cappedHigh), unit);
  if (estimatedSalaryLow >= estimatedSalaryHigh) {
    // Widen downward rather than upward so the uplift cap is never exceeded.
    estimatedSalaryLow = Math.max(0, estimatedSalaryHigh - unit);
  }

  const currentBenchmark = findBenchmark(masters.benchmarks, {
    occupationId: currentOccupation.id,
    regionId: currentRegion?.id ?? null,
    nationalRegionId: nationalRegion?.id ?? null,
    experienceBand,
    educationLevel: input.educationLevel,
  });

  const bestMatchScore = shown[0]?.matchScore ?? 0;
  const improvementHigh = estimatedSalaryHigh - input.currentSalary;
  const improvementLow = estimatedSalaryLow - input.currentSalary;

  const upsideScore = clamp((Math.max(0, improvementHigh) / config.marketValue.upsideFullJpy) * 100, 0, 100);
  const marketValueScore = Math.round(
    clamp(
      config.marketValue.matchWeight * bestMatchScore + config.marketValue.upsideWeight * upsideScore,
      0,
      100,
    ),
  );
  const valueRank = rankFromScore(marketValueScore, config.rankThresholds);

  const valuedSkills = collectValuedSkills(shown, masters, heldSkills, skillById);
  const shownOccupationIds = new Set(shown.map((o) => o.occupationId));
  const valuedCertifications = masters.occupationCertifications
    .filter((oc) => shownOccupationIds.has(oc.occupationId) && heldCerts.has(oc.certificationId))
    .sort((a, b) => b.importanceWeight - a.importanceWeight)
    .map((oc) => certById.get(oc.certificationId))
    .filter((c): c is CertificationRef => Boolean(c))
    .filter((c, index, all) => all.findIndex((other) => other.id === c.id) === index)
    .slice(0, 5);

  const confidences = withBenchmark.map((o) => o.benchmark.confidenceLevel);
  const dataConfidence = confidences.includes('low')
    ? 'low'
    : confidences.length === 0
      ? 'low'
      : confidences.every((c) => c === 'high')
        ? 'high'
        : 'medium';

  return {
    engineVersion: DIAGNOSIS_ENGINE_VERSION,
    currentSalary: input.currentSalary,
    currentOccupationId: currentOccupation.id,
    currentOccupationName: currentOccupation.name,
    regionId: targetRegion?.id ?? null,
    experienceBand,
    currentMarketMedian: currentBenchmark?.salaryMedian ?? null,
    estimatedSalaryLow,
    estimatedSalaryHigh,
    improvementLow,
    improvementHigh,
    valueRank,
    marketValueScore,
    bestMatchScore,
    qualified:
      marketValueScore >= config.qualifiedMinScore && improvementHigh >= config.qualifiedMinUpsideJpy,
    options: shown,
    adjacentOptions: shown.filter((o) => !o.isCurrentOccupation),
    upsideOptions: [...shown]
      .filter((o) => o.expectedUpside !== null)
      .sort((a, b) => (b.expectedUpside ?? 0) - (a.expectedUpside ?? 0)),
    valuedSkills,
    valuedCertifications,
    dataConfidence,
    warnings,
  };
}

function collectValuedSkills(
  shown: OccupationOption[],
  masters: DiagnosisMasters,
  heldSkills: Set<string>,
  skillById: Map<string, SkillRef>,
): SkillRef[] {
  const weightBySkill = new Map<string, number>();
  for (const option of shown) {
    for (const link of masters.occupationSkills) {
      if (link.occupationId !== option.occupationId) continue;
      if (!heldSkills.has(link.skillId)) continue;
      const current = weightBySkill.get(link.skillId) ?? 0;
      weightBySkill.set(link.skillId, current + link.importanceWeight);
    }
  }
  return [...weightBySkill.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => skillById.get(id))
    .filter((s): s is SkillRef => Boolean(s))
    .slice(0, 5);
}
