import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  careerTransitionRules,
  certifications,
  occupationCertifications,
  occupations,
  occupationSkills,
  salaryMarketBenchmarks,
  skills,
} from "@/lib/db/schema";
import type { DiagnosisMasterData } from "./engine";
import type {
  EducationLevel,
  ExperienceBand,
  OccupationMaster,
  SalaryBenchmark,
  TransitionRule,
} from "./types";

/**
 * Loads every master table the engine needs in one pass. The dataset is small
 * and read-mostly, so a single load per diagnosis keeps the engine pure without
 * an N+1 query problem.
 */
export async function loadDiagnosisMasterData(
  db: Database,
): Promise<DiagnosisMasterData> {
  const [
    occupationRows,
    occupationSkillRows,
    occupationCertificationRows,
    ruleRows,
    benchmarkRows,
    skillRows,
    certificationRows,
  ] = await Promise.all([
    db.select().from(occupations).where(eq(occupations.active, true)),
    db.select().from(occupationSkills),
    db.select().from(occupationCertifications),
    db.select().from(careerTransitionRules).where(eq(careerTransitionRules.active, true)),
    db
      .select()
      .from(salaryMarketBenchmarks)
      .where(eq(salaryMarketBenchmarks.active, true)),
    db.select().from(skills),
    db.select().from(certifications),
  ]);

  const occupationMap = new Map<number, OccupationMaster>();
  for (const row of occupationRows) {
    occupationMap.set(row.id, {
      id: row.id,
      name: row.name,
      category: row.category,
      requiresTravel: row.requiresTravel,
      requiresNightShift: row.requiresNightShift,
      requiresRelocation: row.requiresRelocation,
      minEducationLevel: (row.minEducationLevel as EducationLevel | null) ?? null,
      managementRelevant: row.managementRelevant,
      skills: [],
      certifications: [],
    });
  }

  for (const row of occupationSkillRows) {
    occupationMap.get(row.occupationId)?.skills.push({
      id: row.skillId,
      weight: Number(row.importanceWeight),
    });
  }
  for (const row of occupationCertificationRows) {
    occupationMap.get(row.occupationId)?.certifications.push({
      id: row.certificationId,
      weight: Number(row.importanceWeight),
    });
  }

  const transitionRules: TransitionRule[] = ruleRows.map((row) => ({
    id: row.id,
    sourceOccupationId: row.sourceOccupationId,
    targetOccupationId: row.targetOccupationId,
    baseTransitionScore: row.baseTransitionScore,
    requiredSkillIds: row.requiredSkillIds,
    preferredSkillIds: row.preferredSkillIds,
    requiredCertificationIds: row.requiredCertificationIds,
    preferredCertificationIds: row.preferredCertificationIds,
    minimumExperienceYears: row.minimumExperienceYears,
  }));

  const benchmarks: SalaryBenchmark[] = benchmarkRows.map((row) => ({
    id: row.id,
    occupationId: row.occupationId,
    regionId: row.regionId,
    experienceBand: row.experienceBand as ExperienceBand,
    educationLevel: (row.educationLevel as EducationLevel | null) ?? null,
    salaryLow: row.salaryLow,
    salaryMedian: row.salaryMedian,
    salaryHigh: row.salaryHigh,
    confidenceLevel: row.confidenceLevel,
    sourceDate: row.sourceDate,
  }));

  return {
    occupations: occupationMap,
    transitionRules,
    benchmarks,
    skillNames: new Map(skillRows.map((row) => [row.id, row.name])),
    certificationNames: new Map(certificationRows.map((row) => [row.id, row.name])),
  };
}
