import { describe, expect, it } from "vitest";
import { DEFAULT_DIAGNOSIS_CONFIG } from "@/lib/config/settings";
import { runDiagnosis } from "@/lib/domain/diagnosis/engine";
import {
  computeCertificationMatch,
  computeExperienceMatch,
  computeLocationMatch,
  computeSkillMatch,
  computeWorkingConditionMatch,
  expectedSalaryForMatch,
  experienceBandFor,
  projectSalaryRange,
  rankFromScore,
  scoreOccupation,
  selectBenchmark,
} from "@/lib/domain/diagnosis/scoring";
import type {
  CandidateProfile,
  OccupationMaster,
  SalaryBenchmark,
  TransitionRule,
} from "@/lib/domain/diagnosis/types";

const config = DEFAULT_DIAGNOSIS_CONFIG;

const SKILL = { faultDiagnosis: 1, maintenance: 2, customerSupport: 3, plc: 4 };
const CERT = { mechanic2: 1, driverLicense: 2 };

const mechanic: OccupationMaster = {
  id: 1,
  name: "自動車整備士",
  category: "整備",
  requiresTravel: false,
  requiresNightShift: false,
  requiresRelocation: false,
  minEducationLevel: null,
  managementRelevant: false,
  skills: [
    { id: SKILL.faultDiagnosis, weight: 1 },
    { id: SKILL.maintenance, weight: 0.9 },
  ],
  certifications: [{ id: CERT.mechanic2, weight: 1 }],
};

const fieldService: OccupationMaster = {
  id: 2,
  name: "フィールドサービスエンジニア",
  category: "サービス",
  requiresTravel: true,
  requiresNightShift: false,
  requiresRelocation: false,
  minEducationLevel: null,
  managementRelevant: false,
  skills: [
    { id: SKILL.faultDiagnosis, weight: 1 },
    { id: SKILL.customerSupport, weight: 0.9 },
    { id: SKILL.maintenance, weight: 0.8 },
  ],
  certifications: [{ id: CERT.driverLicense, weight: 0.9 }],
};

const nightJob: OccupationMaster = {
  ...fieldService,
  id: 3,
  name: "設備保全",
  requiresTravel: false,
  requiresNightShift: true,
};

const rule: TransitionRule = {
  id: 10,
  sourceOccupationId: mechanic.id,
  targetOccupationId: fieldService.id,
  baseTransitionScore: 85,
  requiredSkillIds: [SKILL.faultDiagnosis],
  preferredSkillIds: [SKILL.customerSupport],
  requiredCertificationIds: [],
  preferredCertificationIds: [CERT.driverLicense],
  minimumExperienceYears: 2,
};

function benchmark(overrides: Partial<SalaryBenchmark> = {}): SalaryBenchmark {
  return {
    id: 1,
    occupationId: fieldService.id,
    regionId: 100,
    experienceBand: "6-9",
    educationLevel: null,
    salaryLow: 4_600_000,
    salaryMedian: 5_400_000,
    salaryHigh: 6_500_000,
    confidenceLevel: "medium",
    sourceDate: "2026-01-01",
    ...overrides,
  };
}

const profile: CandidateProfile = {
  currentOccupationId: mechanic.id,
  currentSalaryYen: 4_300_000,
  experienceYears: 7,
  experienceBand: "6-9",
  educationLevel: "vocational",
  employmentType: "full_time",
  managementYears: 0,
  skillIds: [SKILL.faultDiagnosis, SKILL.maintenance, SKILL.customerSupport],
  certificationIds: [CERT.mechanic2, CERT.driverLicense],
  currentRegionId: 100,
  desiredRegionIds: [100],
  relocationOk: false,
  travelOk: true,
  nightShiftOk: false,
};

describe("skill match", () => {
  it("is the importance-weighted share of the target's skills that the candidate holds", () => {
    /* Holds fault_diagnosis (1.0) + maintenance (0.8) of 1.0+0.9+0.8 = 2.7 */
    const score = computeSkillMatch(
      [SKILL.faultDiagnosis, SKILL.maintenance],
      fieldService.skills,
      [],
      config.neutralComponentScore,
    );
    expect(score).toBeCloseTo(1.8 / 2.7, 5);
  });

  it("counts a preferred skill from the transition rule", () => {
    const withoutPreferred = computeSkillMatch(
      [SKILL.faultDiagnosis],
      mechanic.skills,
      [],
      config.neutralComponentScore,
    );
    const withPreferred = computeSkillMatch(
      [SKILL.faultDiagnosis, SKILL.customerSupport],
      mechanic.skills,
      [SKILL.customerSupport],
      config.neutralComponentScore,
    );
    expect(withPreferred).toBeGreaterThan(withoutPreferred);
  });

  it("falls back to the neutral score when the occupation has no skill data", () => {
    expect(computeSkillMatch([1, 2], [], [], 0.6)).toBe(0.6);
  });

  it("returns 0 when the candidate holds none of the required skills", () => {
    expect(
      computeSkillMatch([99], fieldService.skills, [], config.neutralComponentScore),
    ).toBe(0);
  });
});

describe("certification match", () => {
  it("scores the weighted share of certifications held", () => {
    expect(
      computeCertificationMatch(
        [CERT.driverLicense],
        fieldService.certifications,
        [],
        config.neutralComponentScore,
      ),
    ).toBe(1);
    expect(
      computeCertificationMatch(
        [CERT.mechanic2],
        fieldService.certifications,
        [],
        config.neutralComponentScore,
      ),
    ).toBe(0);
  });
});

describe("experience match", () => {
  it("degrades below the rule's minimum", () => {
    expect(computeExperienceMatch(1, 4, 5)).toBeCloseTo(0.175, 5);
    expect(computeExperienceMatch(0, 4, 5)).toBe(0);
  });

  it("rises towards 1 above the minimum", () => {
    expect(computeExperienceMatch(2, 2, 5)).toBeCloseTo(0.82, 5);
    expect(computeExperienceMatch(5, 2, 5)).toBe(1);
    expect(computeExperienceMatch(20, 2, 5)).toBe(1);
  });

  it("maps years onto bands", () => {
    expect(experienceBandFor(0)).toBe("0-2");
    expect(experienceBandFor(4)).toBe("3-5");
    expect(experienceBandFor(9)).toBe("6-9");
    expect(experienceBandFor(14)).toBe("10-14");
    expect(experienceBandFor(30)).toBe("15+");
  });
});

describe("location and working-condition match", () => {
  it("rewards a benchmark region the candidate actually wants", () => {
    expect(computeLocationMatch(100, profile)).toBe(1);
    expect(computeLocationMatch(200, profile)).toBe(0.3);
    expect(computeLocationMatch(200, { ...profile, relocationOk: true })).toBe(0.6);
  });

  it("scores only the conditions the occupation actually requires", () => {
    expect(computeWorkingConditionMatch(fieldService, profile)).toBe(1);
    expect(computeWorkingConditionMatch(nightJob, profile)).toBe(0);
    expect(computeWorkingConditionMatch(mechanic, profile)).toBe(1);
  });
});

describe("occupation scoring", () => {
  it("penalises every unmet required skill and reports it", () => {
    const withSkill = scoreOccupation({
      profile,
      occupation: fieldService,
      rule,
      benchmark: benchmark(),
      config,
    });
    const withoutSkill = scoreOccupation({
      profile: { ...profile, skillIds: [SKILL.maintenance, SKILL.customerSupport] },
      occupation: fieldService,
      rule,
      benchmark: benchmark(),
      config,
    });

    expect(withSkill.unmetRequirements.skillIds).toEqual([]);
    expect(withoutSkill.unmetRequirements.skillIds).toEqual([SKILL.faultDiagnosis]);
    expect(withoutSkill.breakdown.requirementPenalty).toBe(config.requirementPenalty);
    expect(withoutSkill.matchScore).toBeLessThan(withSkill.matchScore - 10);
  });

  it("applies the transition plausibility factor from the rule", () => {
    const strong = scoreOccupation({
      profile,
      occupation: fieldService,
      rule,
      benchmark: benchmark(),
      config,
    });
    const weak = scoreOccupation({
      profile,
      occupation: fieldService,
      rule: { ...rule, baseTransitionScore: 20 },
      benchmark: benchmark(),
      config,
    });
    expect(weak.matchScore).toBeLessThan(strong.matchScore);
    expect(strong.breakdown.transitionFactor).toBeGreaterThan(
      weak.breakdown.transitionFactor,
    );
  });

  it("stays inside 0-100 and records every component", () => {
    const result = scoreOccupation({
      profile,
      occupation: fieldService,
      rule,
      benchmark: benchmark(),
      config,
    });
    expect(result.matchScore).toBeGreaterThanOrEqual(0);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(Object.keys(result.breakdown)).toEqual(
      expect.arrayContaining([
        "skill",
        "certification",
        "experience",
        "location",
        "workingCondition",
        "profile",
        "transitionFactor",
        "requirementPenalty",
        "final",
      ]),
    );
  });
});

describe("rank calculation", () => {
  it("maps scores onto S/A/B/C at the configured thresholds", () => {
    expect(rankFromScore(100, config.rankThresholds)).toBe("S");
    expect(rankFromScore(85, config.rankThresholds)).toBe("S");
    expect(rankFromScore(84, config.rankThresholds)).toBe("A");
    expect(rankFromScore(70, config.rankThresholds)).toBe("A");
    expect(rankFromScore(69, config.rankThresholds)).toBe("B");
    expect(rankFromScore(55, config.rankThresholds)).toBe("B");
    expect(rankFromScore(54, config.rankThresholds)).toBe("C");
    expect(rankFromScore(0, config.rankThresholds)).toBe("C");
  });

  it("follows the thresholds when they are reconfigured", () => {
    const custom = { S: 60, A: 40, B: 20 };
    expect(rankFromScore(65, custom)).toBe("S");
    expect(rankFromScore(45, custom)).toBe("A");
    expect(rankFromScore(25, custom)).toBe("B");
    expect(rankFromScore(10, custom)).toBe("C");
  });
});

describe("benchmark selection", () => {
  const rows: SalaryBenchmark[] = [
    benchmark({ id: 1, regionId: null, experienceBand: "6-9" }),
    benchmark({ id: 2, regionId: 100, experienceBand: "6-9" }),
    benchmark({ id: 3, regionId: 100, experienceBand: "0-2" }),
    benchmark({ id: 4, regionId: 999, experienceBand: "6-9" }),
  ];

  it("prefers the desired region over the national fallback", () => {
    expect(selectBenchmark(rows, fieldService.id, [100], "6-9", null)?.id).toBe(2);
  });

  it("falls back to the national row when the region has no data", () => {
    expect(selectBenchmark(rows, fieldService.id, [555], "6-9", null)?.id).toBe(1);
  });

  it("prefers the exact experience band", () => {
    expect(selectBenchmark(rows, fieldService.id, [100], "0-2", null)?.id).toBe(3);
  });

  it("returns null when the occupation has no data at all", () => {
    expect(selectBenchmark(rows, 12345, [100], "6-9", null)).toBeNull();
  });
});

describe("salary range calculation", () => {
  it("places a strong match in the upper half of the market band", () => {
    const weak = expectedSalaryForMatch(benchmark(), 0);
    const strong = expectedSalaryForMatch(benchmark(), 100);
    expect(weak.low).toBe(4_600_000);
    expect(weak.high).toBe(5_400_000);
    expect(strong.low).toBe(5_400_000);
    expect(strong.high).toBe(6_500_000);
  });

  it("rounds outward to the configured display unit", () => {
    const projected = projectSalaryRange(
      [{ low: 5_110_000, high: 5_780_000, matchScore: 80 }],
      100_000,
    );
    expect(projected).toEqual({ low: 5_100_000, high: 5_800_000 });
  });

  it("weights options by their match score", () => {
    const projected = projectSalaryRange(
      [
        { low: 5_000_000, high: 6_000_000, matchScore: 90 },
        { low: 3_000_000, high: 4_000_000, matchScore: 10 },
      ],
      100_000,
    );
    expect(projected?.low).toBe(4_800_000);
  });

  it("never returns a zero-width range", () => {
    const projected = projectSalaryRange(
      [{ low: 5_000_000, high: 5_000_000, matchScore: 50 }],
      100_000,
    );
    expect(projected?.high).toBeGreaterThan(projected?.low ?? 0);
  });

  it("returns null when no option has salary data", () => {
    expect(projectSalaryRange([], 100_000)).toBeNull();
  });
});

describe("runDiagnosis", () => {
  const master = {
    occupations: new Map([
      [mechanic.id, mechanic],
      [fieldService.id, fieldService],
      [nightJob.id, nightJob],
    ]),
    transitionRules: [
      rule,
      {
        ...rule,
        id: 11,
        targetOccupationId: nightJob.id,
        baseTransitionScore: 70,
        requiredSkillIds: [SKILL.maintenance],
        preferredSkillIds: [],
        preferredCertificationIds: [],
      },
    ],
    benchmarks: [
      benchmark({ id: 1, occupationId: mechanic.id, salaryMedian: 4_400_000, salaryLow: 3_700_000, salaryHigh: 5_300_000 }),
      benchmark({ id: 2, occupationId: fieldService.id }),
      benchmark({ id: 3, occupationId: nightJob.id, salaryMedian: 4_700_000, salaryLow: 4_000_000, salaryHigh: 5_600_000 }),
    ],
    skillNames: new Map([
      [SKILL.faultDiagnosis, "故障診断"],
      [SKILL.maintenance, "機械メンテナンス"],
      [SKILL.customerSupport, "顧客対応"],
    ]),
    certificationNames: new Map([
      [CERT.mechanic2, "自動車整備士2級"],
      [CERT.driverLicense, "普通自動車免許"],
    ]),
  };

  it("produces a rounded range, an uplift and a rank", () => {
    const result = runDiagnosis(profile, master, config);

    expect(result.estimatedSalaryLow! % config.salaryRoundingUnit).toBe(0);
    expect(result.estimatedSalaryHigh! % config.salaryRoundingUnit).toBe(0);
    expect(result.estimatedSalaryHigh!).toBeGreaterThan(result.estimatedSalaryLow!);
    expect(result.upliftLow).toBe(result.estimatedSalaryLow! - profile.currentSalaryYen);
    expect(["S", "A", "B", "C"]).toContain(result.matchRank);
    expect(result.engineVersion).toBe(config.engineVersion);
  });

  it("only offers career options that clear the configured minimum score", () => {
    const result = runDiagnosis(profile, master, config);
    for (const option of result.careerOptions) {
      expect(option.matchScore).toBeGreaterThanOrEqual(config.minMatchScore);
      expect(option.isCurrent).toBe(false);
    }
    expect(result.careerOptions.length).toBeLessThanOrEqual(config.maxCareerOptions);
  });

  it("ranks market value by transferability, not by fit with the current job", () => {
    const result = runDiagnosis(profile, master, config);
    const targets = result.matches.filter((match) => !match.isCurrent);
    expect(result.bestMatchScore).toBe(Math.max(...targets.map((m) => m.matchScore)));
  });

  it("surfaces the candidate's own valued experiences", () => {
    const result = runDiagnosis(profile, master, config);
    expect(result.valuedExperiences.length).toBeGreaterThan(0);
    expect(result.valuedExperiences).toContain("故障診断");
    /* Never suggests something the candidate did not claim. */
    expect(result.valuedExperiences).not.toContain("PLC制御");
  });

  it("trims the top of the range to the configured multiple of current pay", () => {
    /* Market band ~4.9M-6.3M; a cap of 1.8x on 3.0M is 5.4M. */
    const underpaid = { ...profile, currentSalaryYen: 3_000_000 };
    const capped = runDiagnosis(underpaid, master, config);
    const uncapped = runDiagnosis(
      underpaid,
      master,
      { ...config, maxUpliftFactor: 5 },
    );

    expect(capped.estimatedSalaryHigh!).toBeLessThan(uncapped.estimatedSalaryHigh!);
    expect(capped.estimatedSalaryHigh!).toBeLessThanOrEqual(
      underpaid.currentSalaryYen * config.maxUpliftFactor + config.salaryRoundingUnit,
    );
  });

  it("does not quote below the market floor when the whole band clears the cap", () => {
    /* Someone on 2.6M whose target occupations start at ~4.9M: capping the top
     * to 4.68M would invent a figure lower than any real job pays. */
    const veryUnderpaid = { ...profile, currentSalaryYen: 2_600_000 };
    const result = runDiagnosis(veryUnderpaid, master, config);
    expect(result.estimatedSalaryHigh!).toBeGreaterThan(result.estimatedSalaryLow!);
    expect(result.estimatedSalaryLow!).toBeGreaterThanOrEqual(4_000_000);
  });

  it("still returns the current market band when no transition qualifies", () => {
    const isolated = { ...master, transitionRules: [] };
    const result = runDiagnosis(profile, isolated, config);
    expect(result.careerOptions).toEqual([]);
    expect(result.currentMarket).not.toBeNull();
    expect(result.estimatedSalaryLow).not.toBeNull();
  });

  it("rejects an unknown current occupation", () => {
    expect(() =>
      runDiagnosis({ ...profile, currentOccupationId: 9999 }, master, config),
    ).toThrow();
  });
});
