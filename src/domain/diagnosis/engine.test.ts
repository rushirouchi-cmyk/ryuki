import { describe, expect, it } from 'vitest';
import {
  certificationMatchRatio,
  experienceMatchRatio,
  expectedSalaryFor,
  findBenchmark,
  locationMatchRatio,
  rankFromScore,
  roundDownTo,
  roundUpTo,
  runDiagnosis,
  skillMatchRatio,
  toExperienceBand,
  workingConditionMatchRatio,
} from './engine';
import { DEFAULT_DIAGNOSIS_CONFIG } from '@/domain/config/diagnosis-config';
import type { DiagnosisInput, DiagnosisMasters, SalaryBenchmark } from './types';

/* ------------------------------------------------------------- fixtures */

const OCC_MECHANIC = 'occ-mechanic';
const OCC_FIELD = 'occ-field';
const OCC_UNRELATED = 'occ-unrelated';
const REGION = 'region-osaka';
const NATIONAL = 'region-national';

const SKILL_DIAG = 'skill-diagnosis';
const SKILL_MAINT = 'skill-maintenance';
const SKILL_CS = 'skill-customer';
const SKILL_PLC = 'skill-plc';

const CERT_MECH2 = 'cert-mech2';
const CERT_LICENSE = 'cert-license';
const CERT_UNRELATED = 'cert-unrelated';

function benchmark(occupationId: string, overrides: Partial<SalaryBenchmark> = {}): SalaryBenchmark {
  return {
    occupationId,
    regionId: REGION,
    experienceBand: '3-5',
    educationLevel: null,
    salaryLow: 3_600_000,
    salaryMedian: 4_400_000,
    salaryHigh: 5_400_000,
    confidenceLevel: 'medium',
    source: 'manual',
    ...overrides,
  };
}

const masters: DiagnosisMasters = {
  occupations: [
    { id: OCC_MECHANIC, name: '自動車整備士', category: '整備' },
    { id: OCC_FIELD, name: 'フィールドサービスエンジニア', category: '技術サービス' },
    { id: OCC_UNRELATED, name: '営業', category: '営業' },
  ],
  skills: [
    { id: SKILL_DIAG, name: '故障診断', category: '技術' },
    { id: SKILL_MAINT, name: '機械メンテナンス', category: '技術' },
    { id: SKILL_CS, name: '顧客対応', category: 'ヒューマン' },
    { id: SKILL_PLC, name: 'PLC制御', category: '技術' },
  ],
  certifications: [
    { id: CERT_MECH2, name: '自動車整備士2級', category: '整備' },
    { id: CERT_LICENSE, name: '普通自動車免許', category: '共通' },
    { id: CERT_UNRELATED, name: '簿記2級', category: '事務' },
  ],
  regions: [
    { id: REGION, name: '大阪', prefecture: '大阪府', isNationalFallback: false },
    { id: NATIONAL, name: '全国', prefecture: '全国', isNationalFallback: true },
  ],
  occupationSkills: [
    { occupationId: OCC_MECHANIC, skillId: SKILL_DIAG, importanceWeight: 1 },
    { occupationId: OCC_MECHANIC, skillId: SKILL_MAINT, importanceWeight: 0.8 },
    { occupationId: OCC_FIELD, skillId: SKILL_DIAG, importanceWeight: 1 },
    { occupationId: OCC_FIELD, skillId: SKILL_CS, importanceWeight: 0.8 },
    { occupationId: OCC_FIELD, skillId: SKILL_PLC, importanceWeight: 0.6 },
  ],
  occupationCertifications: [
    { occupationId: OCC_MECHANIC, certificationId: CERT_MECH2, importanceWeight: 1 },
    { occupationId: OCC_FIELD, certificationId: CERT_LICENSE, importanceWeight: 1 },
    { occupationId: OCC_FIELD, certificationId: CERT_MECH2, importanceWeight: 0.5 },
  ],
  transitionRules: [
    {
      id: 'rule-1',
      sourceOccupationId: OCC_MECHANIC,
      targetOccupationId: OCC_FIELD,
      baseTransitionScore: 78,
      requiredSkillIds: [SKILL_DIAG],
      preferredSkillIds: [SKILL_CS],
      requiredCertificationIds: [],
      preferredCertificationIds: [CERT_LICENSE],
      minimumExperienceYears: 2,
      requiresRelocation: false,
      requiresBusinessTrip: true,
      requiresNightShift: false,
      notes: 'テスト用ルール',
    },
  ],
  benchmarks: [
    benchmark(OCC_MECHANIC, { salaryLow: 3_200_000, salaryMedian: 3_900_000, salaryHigh: 4_600_000 }),
    benchmark(OCC_FIELD),
    benchmark(OCC_FIELD, { regionId: NATIONAL, salaryMedian: 4_200_000, confidenceLevel: 'low' }),
  ],
};

const baseInput: DiagnosisInput = {
  currentSalary: 4_300_000,
  currentOccupationId: OCC_MECHANIC,
  currentIndustry: '自動車・輸送機器',
  experienceYears: 4,
  skillIds: [SKILL_DIAG, SKILL_MAINT, SKILL_CS],
  certificationIds: [CERT_MECH2, CERT_LICENSE],
  hasManagementExperience: false,
  employmentType: 'full_time',
  currentPrefecture: '大阪府',
  desiredPrefectures: ['大阪府'],
  relocationOk: false,
  businessTripOk: true,
  nightShiftOk: false,
  educationLevel: 'vocational',
  desiredConditions: ['年収アップ'],
  ageBand: '30代前半',
  jobChangeTiming: '3〜6ヶ月',
};

/* ------------------------------------------------------- component scores */

describe('experience band', () => {
  it('maps years to the correct band', () => {
    expect(toExperienceBand(0)).toBe('0-2');
    expect(toExperienceBand(2)).toBe('0-2');
    expect(toExperienceBand(3)).toBe('3-5');
    expect(toExperienceBand(9)).toBe('6-9');
    expect(toExperienceBand(14)).toBe('10-14');
    expect(toExperienceBand(30)).toBe('15+');
  });
});

describe('skillMatchRatio', () => {
  const occupationSkills = [
    { skillId: SKILL_DIAG, importanceWeight: 1 },
    { skillId: SKILL_CS, importanceWeight: 0.8 },
    { skillId: SKILL_PLC, importanceWeight: 0.6 },
  ];

  it('is 1 when every weighted skill and requirement is covered', () => {
    const ratio = skillMatchRatio({
      occupationSkills,
      requiredSkillIds: [SKILL_DIAG],
      preferredSkillIds: [SKILL_CS],
      heldSkillIds: new Set([SKILL_DIAG, SKILL_CS, SKILL_PLC]),
    });
    expect(ratio).toBeCloseTo(1, 5);
  });

  it('is 0 when no skills are held', () => {
    const ratio = skillMatchRatio({
      occupationSkills,
      requiredSkillIds: [SKILL_DIAG],
      preferredSkillIds: [],
      heldSkillIds: new Set(),
    });
    expect(ratio).toBe(0);
  });

  it('weights the most important skill highest', () => {
    const withImportant = skillMatchRatio({
      occupationSkills,
      requiredSkillIds: [],
      preferredSkillIds: [],
      heldSkillIds: new Set([SKILL_DIAG]),
    });
    const withMinor = skillMatchRatio({
      occupationSkills,
      requiredSkillIds: [],
      preferredSkillIds: [],
      heldSkillIds: new Set([SKILL_PLC]),
    });
    expect(withImportant).toBeGreaterThan(withMinor);
  });

  it('penalises a missing required skill even when coverage is otherwise good', () => {
    const withRequired = skillMatchRatio({
      occupationSkills,
      requiredSkillIds: [SKILL_DIAG],
      preferredSkillIds: [],
      heldSkillIds: new Set([SKILL_DIAG, SKILL_CS]),
    });
    const withoutRequired = skillMatchRatio({
      occupationSkills,
      requiredSkillIds: [SKILL_DIAG],
      preferredSkillIds: [],
      heldSkillIds: new Set([SKILL_CS, SKILL_PLC]),
    });
    expect(withRequired).toBeGreaterThan(withoutRequired + 0.2);
  });
});

describe('certificationMatchRatio', () => {
  const occupationCertifications = [
    { certificationId: CERT_LICENSE, importanceWeight: 1 },
    { certificationId: CERT_MECH2, importanceWeight: 0.5 },
  ];

  it('gives no credit for certifications irrelevant to the occupation', () => {
    const ratio = certificationMatchRatio({
      occupationCertifications,
      requiredCertificationIds: [],
      preferredCertificationIds: [],
      heldCertificationIds: new Set([CERT_UNRELATED]),
    });
    expect(ratio).toBe(0);
  });

  it('scores relevant certifications by importance', () => {
    const strong = certificationMatchRatio({
      occupationCertifications,
      requiredCertificationIds: [],
      preferredCertificationIds: [],
      heldCertificationIds: new Set([CERT_LICENSE]),
    });
    const weak = certificationMatchRatio({
      occupationCertifications,
      requiredCertificationIds: [],
      preferredCertificationIds: [],
      heldCertificationIds: new Set([CERT_MECH2]),
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeCloseTo(1 / 1.5, 5);
  });

  it('returns a neutral 0.5 for occupations with no certification culture', () => {
    const ratio = certificationMatchRatio({
      occupationCertifications: [],
      requiredCertificationIds: [],
      preferredCertificationIds: [],
      heldCertificationIds: new Set(),
    });
    expect(ratio).toBe(0.5);
  });

  it('rewards holding the certifications a transition rule requires', () => {
    const held = certificationMatchRatio({
      occupationCertifications,
      requiredCertificationIds: [CERT_LICENSE],
      preferredCertificationIds: [],
      heldCertificationIds: new Set([CERT_LICENSE]),
    });
    const missing = certificationMatchRatio({
      occupationCertifications,
      requiredCertificationIds: [CERT_LICENSE],
      preferredCertificationIds: [],
      heldCertificationIds: new Set([CERT_MECH2]),
    });
    expect(held).toBeGreaterThan(missing);
  });
});

describe('experienceMatchRatio', () => {
  it('gives partial credit below the rule minimum', () => {
    expect(experienceMatchRatio({ years: 1, minimumYears: 4, fullBonusYears: 5 })).toBeCloseTo(0.175, 3);
  });

  it('reaches the baseline exactly at the minimum', () => {
    expect(experienceMatchRatio({ years: 4, minimumYears: 4, fullBonusYears: 5 })).toBeCloseTo(0.6, 5);
  });

  it('reaches 1 once the surplus covers the bonus window', () => {
    expect(experienceMatchRatio({ years: 9, minimumYears: 4, fullBonusYears: 5 })).toBeCloseTo(1, 5);
    expect(experienceMatchRatio({ years: 30, minimumYears: 4, fullBonusYears: 5 })).toBeCloseTo(1, 5);
  });
});

describe('locationMatchRatio', () => {
  it('is perfect when the desired area includes the current one', () => {
    expect(
      locationMatchRatio({
        currentPrefecture: '大阪府',
        desiredPrefectures: ['大阪府'],
        relocationOk: false,
        requiresRelocation: false,
      }),
    ).toBe(1);
  });

  it('penalises roles that require relocation when the candidate cannot move', () => {
    expect(
      locationMatchRatio({
        currentPrefecture: '大阪府',
        desiredPrefectures: ['大阪府'],
        relocationOk: false,
        requiresRelocation: true,
      }),
    ).toBe(0.2);
  });
});

describe('workingConditionMatchRatio', () => {
  it('is 1 when the role has no special requirements', () => {
    expect(
      workingConditionMatchRatio({
        requiresRelocation: false,
        requiresBusinessTrip: false,
        requiresNightShift: false,
        relocationOk: false,
        businessTripOk: false,
        nightShiftOk: false,
      }),
    ).toBe(1);
  });

  it('averages over the requirements the candidate can meet', () => {
    expect(
      workingConditionMatchRatio({
        requiresRelocation: false,
        requiresBusinessTrip: true,
        requiresNightShift: true,
        relocationOk: false,
        businessTripOk: true,
        nightShiftOk: false,
      }),
    ).toBe(0.5);
  });
});

/* --------------------------------------------------------- salary & rank */

describe('findBenchmark', () => {
  it('falls back to the national row when the region has no data', () => {
    const found = findBenchmark(masters.benchmarks, {
      occupationId: OCC_FIELD,
      regionId: 'region-unknown',
      nationalRegionId: NATIONAL,
      experienceBand: '3-5',
      educationLevel: 'vocational',
    });
    expect(found?.regionId).toBe(NATIONAL);
  });

  it('returns null when no benchmark exists at all', () => {
    const found = findBenchmark(masters.benchmarks, {
      occupationId: OCC_UNRELATED,
      regionId: REGION,
      nationalRegionId: NATIONAL,
      experienceBand: '3-5',
      educationLevel: 'vocational',
    });
    expect(found).toBeNull();
  });
});

describe('expectedSalaryFor', () => {
  const bench = benchmark(OCC_FIELD);

  it('sits on the median at the anchor score', () => {
    expect(expectedSalaryFor(bench, 70)).toBe(bench.salaryMedian);
  });

  it('reaches the market high at a perfect score', () => {
    expect(expectedSalaryFor(bench, 100)).toBe(bench.salaryHigh);
  });

  it('does not fall below the market low for weak matches', () => {
    expect(expectedSalaryFor(bench, 10)).toBe(bench.salaryLow);
  });

  it('increases monotonically with the match score', () => {
    expect(expectedSalaryFor(bench, 60)).toBeLessThan(expectedSalaryFor(bench, 80));
  });
});

describe('rankFromScore', () => {
  const thresholds = DEFAULT_DIAGNOSIS_CONFIG.rankThresholds;

  it('maps scores onto S/A/B/C', () => {
    expect(rankFromScore(92, thresholds)).toBe('S');
    expect(rankFromScore(85, thresholds)).toBe('S');
    expect(rankFromScore(84, thresholds)).toBe('A');
    expect(rankFromScore(70, thresholds)).toBe('A');
    expect(rankFromScore(69, thresholds)).toBe('B');
    expect(rankFromScore(55, thresholds)).toBe('B');
    expect(rankFromScore(54, thresholds)).toBe('C');
    expect(rankFromScore(0, thresholds)).toBe('C');
  });

  it('honours reconfigured thresholds', () => {
    expect(rankFromScore(80, { S: 75, A: 60, B: 40 })).toBe('S');
  });
});

describe('rounding', () => {
  it('rounds the range outward to the configured unit', () => {
    expect(roundDownTo(5_119_000, 100_000)).toBe(5_100_000);
    expect(roundUpTo(5_781_000, 100_000)).toBe(5_800_000);
  });
});

/* --------------------------------------------------------- full pipeline */

describe('runDiagnosis', () => {
  it('produces an explainable, rounded result for the current and adjacent occupations', () => {
    const result = runDiagnosis(baseInput, masters, DEFAULT_DIAGNOSIS_CONFIG);

    expect(result.currentOccupationName).toBe('自動車整備士');
    expect(result.experienceBand).toBe('3-5');
    expect(result.options.length).toBeGreaterThanOrEqual(2);
    expect(result.adjacentOptions.map((option) => option.occupationName)).toContain(
      'フィールドサービスエンジニア',
    );

    // ranges are rounded to 100,000 JPY — no false precision
    expect(result.estimatedSalaryLow % 100_000).toBe(0);
    expect(result.estimatedSalaryHigh % 100_000).toBe(0);
    expect(result.estimatedSalaryHigh).toBeGreaterThan(result.estimatedSalaryLow);

    // every option carries a component breakdown
    for (const option of result.options) {
      const sum =
        option.breakdown.skill +
        option.breakdown.certification +
        option.breakdown.experience +
        option.breakdown.location +
        option.breakdown.workingCondition +
        option.breakdown.educationManagement;
      expect(sum).toBeGreaterThan(0);
      expect(option.matchScore).toBeGreaterThanOrEqual(0);
      expect(option.matchScore).toBeLessThanOrEqual(100);
    }

    expect(['S', 'A', 'B', 'C']).toContain(result.valueRank);
    expect(result.improvementHigh).toBe(result.estimatedSalaryHigh - result.currentSalary);
  });

  it('scores a candidate with the right skills and certifications above one without', () => {
    const strong = runDiagnosis(baseInput, masters, DEFAULT_DIAGNOSIS_CONFIG);
    const weak = runDiagnosis(
      { ...baseInput, skillIds: [SKILL_MAINT], certificationIds: [CERT_UNRELATED] },
      masters,
      DEFAULT_DIAGNOSIS_CONFIG,
    );
    expect(strong.bestMatchScore).toBeGreaterThan(weak.bestMatchScore);
    expect(strong.marketValueScore).toBeGreaterThan(weak.marketValueScore);
  });

  it('drops the business-trip role for a candidate who cannot travel', () => {
    const traveller = runDiagnosis(baseInput, masters, DEFAULT_DIAGNOSIS_CONFIG);
    const homebody = runDiagnosis({ ...baseInput, businessTripOk: false }, masters, DEFAULT_DIAGNOSIS_CONFIG);

    const scoreOf = (result: ReturnType<typeof runDiagnosis>) =>
      result.options.find((option) => option.occupationId === OCC_FIELD)?.matchScore ?? 0;

    expect(scoreOf(traveller)).toBeGreaterThan(scoreOf(homebody));
  });

  it('respects a reconfigured weighting without code changes', () => {
    // Strong skills, no relevant certification: moving weight onto the
    // certification axis must lower this candidate's score.
    const input = { ...baseInput, certificationIds: [CERT_UNRELATED] };
    const certHeavy = runDiagnosis(input, masters, {
      ...DEFAULT_DIAGNOSIS_CONFIG,
      weights: { ...DEFAULT_DIAGNOSIS_CONFIG.weights, certification: 60, skill: 10 },
    });
    const defaultWeights = runDiagnosis(input, masters, DEFAULT_DIAGNOSIS_CONFIG);
    expect(certHeavy.bestMatchScore).toBeLessThan(defaultWeights.bestMatchScore);
  });

  it('warns instead of inventing numbers when market data is missing', () => {
    const result = runDiagnosis(
      { ...baseInput, currentOccupationId: OCC_UNRELATED },
      { ...masters, transitionRules: [] },
      DEFAULT_DIAGNOSIS_CONFIG,
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.dataConfidence).toBe('low');
  });

  it('flags a qualified candidate only when both score and upside clear the bar', () => {
    const result = runDiagnosis(baseInput, masters, {
      ...DEFAULT_DIAGNOSIS_CONFIG,
      qualifiedMinScore: 99,
      qualifiedMinUpsideJpy: 0,
    });
    expect(result.qualified).toBe(false);
  });

  it('rejects an unknown occupation rather than guessing', () => {
    expect(() => runDiagnosis({ ...baseInput, currentOccupationId: 'nope' }, masters)).toThrow();
  });
});

describe('conservatism guards', () => {
  it('discounts occupations the candidate has never worked in', () => {
    const noDiscount = runDiagnosis(baseInput, masters, {
      ...DEFAULT_DIAGNOSIS_CONFIG,
      crossOccupationDiscount: 1,
    });
    const discounted = runDiagnosis(baseInput, masters, {
      ...DEFAULT_DIAGNOSIS_CONFIG,
      crossOccupationDiscount: 0.8,
    });

    const adjacentSalary = (result: ReturnType<typeof runDiagnosis>) =>
      result.options.find((option) => option.occupationId === OCC_FIELD)?.expectedSalary ?? 0;
    const currentSalary = (result: ReturnType<typeof runDiagnosis>) =>
      result.options.find((option) => option.occupationId === OCC_MECHANIC)?.expectedSalary ?? 0;

    expect(adjacentSalary(discounted)).toBeLessThan(adjacentSalary(noDiscount));
    // the current occupation is never discounted
    expect(currentSalary(discounted)).toBe(currentSalary(noDiscount));
  });

  it('never headlines more than the configured multiple of the current salary', () => {
    const result = runDiagnosis({ ...baseInput, currentSalary: 3_000_000 }, masters, {
      ...DEFAULT_DIAGNOSIS_CONFIG,
      maxUpliftMultiple: 1.2,
    });
    expect(result.estimatedSalaryHigh).toBeLessThanOrEqual(roundUpTo(3_600_000, 100_000));
    expect(result.estimatedSalaryLow).toBeLessThanOrEqual(result.estimatedSalaryHigh);
  });
});
