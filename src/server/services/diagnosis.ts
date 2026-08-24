import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { runDiagnosis } from '@/domain/diagnosis/engine';
import type { DiagnosisInput, DiagnosisMasters, DiagnosisResult } from '@/domain/diagnosis/types';
import { salaryFromBand, type DiagnosisAnswers } from '@/domain/diagnosis/input-schema';
import { getDiagnosisConfig } from '@/server/settings';
import { recordCandidateEvent } from './events';

export async function loadDiagnosisMasters(): Promise<DiagnosisMasters> {
  const db = getDb();
  const [
    occupations,
    skills,
    certifications,
    regions,
    occupationSkills,
    occupationCertifications,
    transitionRules,
    benchmarks,
  ] = await Promise.all([
      db.query.occupations.findMany({ where: eq(schema.occupations.active, true) }),
      db.query.skills.findMany(),
      db.query.certifications.findMany(),
      db.query.regions.findMany(),
      db.query.occupationSkills.findMany(),
      db.query.occupationCertifications.findMany(),
      db.query.careerTransitionRules.findMany({ where: eq(schema.careerTransitionRules.active, true) }),
    db.query.salaryMarketBenchmarks.findMany(),
  ]);

  return {
    occupations: occupations.map((o) => ({
      id: o.id,
      name: o.name,
      category: o.category,
      description: o.description,
    })),
    skills: skills.map((s) => ({ id: s.id, name: s.name, category: s.category })),
    certifications: certifications.map((c) => ({ id: c.id, name: c.name, category: c.category })),
    regions: regions.map((r) => ({
      id: r.id,
      name: r.name,
      prefecture: r.prefecture,
      isNationalFallback: r.isNationalFallback,
    })),
    occupationSkills: occupationSkills.map((os) => ({
      occupationId: os.occupationId,
      skillId: os.skillId,
      importanceWeight: Number(os.importanceWeight),
    })),
    occupationCertifications: occupationCertifications.map((oc) => ({
      occupationId: oc.occupationId,
      certificationId: oc.certificationId,
      importanceWeight: Number(oc.importanceWeight),
    })),
    transitionRules: transitionRules.map((r) => ({
      id: r.id,
      sourceOccupationId: r.sourceOccupationId,
      targetOccupationId: r.targetOccupationId,
      baseTransitionScore: r.baseTransitionScore,
      requiredSkillIds: r.requiredSkillIds,
      preferredSkillIds: r.preferredSkillIds,
      requiredCertificationIds: r.requiredCertificationIds,
      preferredCertificationIds: r.preferredCertificationIds,
      minimumExperienceYears: r.minimumExperienceYears,
      requiresRelocation: r.requiresRelocation,
      requiresBusinessTrip: r.requiresBusinessTrip,
      requiresNightShift: r.requiresNightShift,
      notes: r.notes,
    })),
    benchmarks: benchmarks.map((b) => ({
      occupationId: b.occupationId,
      regionId: b.regionId,
      experienceBand: b.experienceBand,
      educationLevel: b.educationLevel,
      salaryLow: b.salaryLow,
      salaryMedian: b.salaryMedian,
      salaryHigh: b.salaryHigh,
      confidenceLevel: b.confidenceLevel,
      source: b.source,
    })),
  };
}

export function toEngineInput(answers: DiagnosisAnswers): DiagnosisInput {
  return {
    currentSalary: salaryFromBand(answers.salaryBand),
    currentOccupationId: answers.occupationId,
    currentIndustry: answers.industry,
    experienceYears: answers.experienceYears,
    skillIds: answers.skillIds,
    certificationIds: answers.certificationIds,
    hasManagementExperience: answers.hasManagementExperience,
    employmentType: answers.employmentType as DiagnosisInput['employmentType'],
    currentPrefecture: answers.currentPrefecture,
    desiredPrefectures: answers.desiredPrefectures,
    relocationOk: answers.relocationOk,
    businessTripOk: answers.businessTripOk,
    nightShiftOk: answers.nightShiftOk,
    educationLevel: answers.educationLevel as DiagnosisInput['educationLevel'],
    desiredConditions: [...answers.desiredConditions],
    ageBand: answers.ageBand,
    jobChangeTiming: answers.jobChangeTiming,
  };
}

/**
 * Runs the engine and persists both the result and the config snapshot used to
 * produce it, so historical results stay reproducible after a retune.
 */
export async function completeDiagnosis(params: {
  candidateId: string;
  answers: DiagnosisAnswers;
}): Promise<DiagnosisResult> {
  const db = getDb();
  const [masters, config] = await Promise.all([loadDiagnosisMasters(), getDiagnosisConfig()]);
  const input = toEngineInput(params.answers);
  const result = runDiagnosis(input, masters, config);

  const [diagnosis] = await db
    .insert(schema.diagnoses)
    .values({
      candidateId: params.candidateId,
      input: params.answers as unknown as Record<string, unknown>,
      currentOccupationId: result.currentOccupationId,
      regionId: result.regionId,
      experienceBand: result.experienceBand,
      currentSalary: result.currentSalary,
      currentMarketMedian: result.currentMarketMedian,
      estimatedSalaryLow: result.estimatedSalaryLow,
      estimatedSalaryHigh: result.estimatedSalaryHigh,
      improvementLow: result.improvementLow,
      improvementHigh: result.improvementHigh,
      valueRank: result.valueRank,
      bestMatchScore: result.bestMatchScore,
      result: result as unknown as Record<string, unknown>,
      configSnapshot: config as unknown as Record<string, unknown>,
      engineVersion: result.engineVersion,
      completedAt: new Date(),
    })
    .returning();

  if (!diagnosis) throw new Error('診断結果の保存に失敗しました。');

  if (result.options.length > 0) {
    await db.insert(schema.diagnosisOccupationMatches).values(
      result.options.map((option, index) => ({
        diagnosisId: diagnosis.id,
        occupationId: option.occupationId,
        isCurrentOccupation: option.isCurrentOccupation,
        matchScore: option.matchScore,
        breakdown: option.breakdown as unknown as Record<string, number>,
        salaryLow: option.benchmark?.salaryLow ?? null,
        salaryMedian: option.benchmark?.salaryMedian ?? null,
        salaryHigh: option.benchmark?.salaryHigh ?? null,
        rankPosition: index + 1,
      })),
    );
  }

  await db
    .update(schema.candidates)
    .set({
      status: 'diagnosed',
      prefecture: input.currentPrefecture,
      desiredPrefectures: input.desiredPrefectures,
      ageBand: input.ageBand,
      jobChangeTiming: input.jobChangeTiming,
      qualified: result.qualified,
      qualifiedAt: result.qualified ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.candidates.id, params.candidateId));

  await recordCandidateEvent({
    candidateId: params.candidateId,
    eventType: 'diagnosis_completed',
    matchScore: result.bestMatchScore,
    marketValueScore: result.marketValueScore,
    qualified: result.qualified,
    metadata: {
      valueRank: result.valueRank,
      estimatedSalaryLow: result.estimatedSalaryLow,
      estimatedSalaryHigh: result.estimatedSalaryHigh,
      engineVersion: result.engineVersion,
    },
  });

  if (result.qualified) {
    await recordCandidateEvent({
      candidateId: params.candidateId,
      eventType: 'candidate_qualified',
      matchScore: result.bestMatchScore,
      marketValueScore: result.marketValueScore,
      qualified: true,
    });
  }

  return result;
}

export async function getLatestDiagnosis(candidateId: string) {
  return getDb().query.diagnoses.findFirst({
    where: eq(schema.diagnoses.candidateId, candidateId),
    orderBy: [desc(schema.diagnoses.completedAt)],
  });
}
