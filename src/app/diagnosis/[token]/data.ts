import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import {
  candidateContacts,
  certifications,
  diagnoses,
  diagnosisOccupationMatches,
  interviewBookings,
  occupations,
  regions,
  skills,
} from "@/lib/db/schema";
import { findCandidateByToken } from "@/lib/domain/candidates/service";

export async function loadCandidate(token: string) {
  const db = await getDb();
  const candidate = await findCandidateByToken(db, token);
  if (!candidate) notFound();
  return { db, candidate };
}

/** Master option lists for the questionnaire. */
export async function loadQuestionOptions() {
  const db = await getDb();
  const [occupationRows, skillRows, certificationRows, regionRows] = await Promise.all([
    db
      .select({ id: occupations.id, name: occupations.name, category: occupations.category })
      .from(occupations)
      .where(eq(occupations.active, true))
      .orderBy(occupations.category, occupations.name),
    db
      .select({ id: skills.id, name: skills.name, category: skills.category })
      .from(skills)
      .orderBy(skills.category, skills.id),
    db
      .select({ id: certifications.id, name: certifications.name })
      .from(certifications)
      .orderBy(certifications.id),
    db
      .select({ id: regions.id, name: regions.name, prefecture: regions.prefecture })
      .from(regions)
      .where(eq(regions.active, true))
      .orderBy(regions.id),
  ]);

  return {
    occupations: occupationRows,
    skills: skillRows,
    certifications: certificationRows,
    regions: regionRows,
  };
}

export async function loadLatestDiagnosis(candidateId: string) {
  const db = await getDb();
  const [diagnosis] = await db
    .select()
    .from(diagnoses)
    .where(and(eq(diagnoses.candidateId, candidateId), eq(diagnoses.status, "completed")))
    .orderBy(desc(diagnoses.completedAt))
    .limit(1);

  if (!diagnosis) return null;

  const matches = await db
    .select({
      occupationId: diagnosisOccupationMatches.occupationId,
      occupationName: occupations.name,
      category: occupations.category,
      description: occupations.description,
      isCurrent: diagnosisOccupationMatches.isCurrent,
      matchScore: diagnosisOccupationMatches.matchScore,
      salaryLow: diagnosisOccupationMatches.salaryLow,
      salaryMedian: diagnosisOccupationMatches.salaryMedian,
      salaryHigh: diagnosisOccupationMatches.salaryHigh,
      rankOrder: diagnosisOccupationMatches.rankOrder,
      breakdown: diagnosisOccupationMatches.scoreBreakdown,
    })
    .from(diagnosisOccupationMatches)
    .innerJoin(occupations, eq(diagnosisOccupationMatches.occupationId, occupations.id))
    .where(eq(diagnosisOccupationMatches.diagnosisId, diagnosis.id))
    .orderBy(diagnosisOccupationMatches.rankOrder);

  const currentOccupation = matches.find((match) => match.isCurrent);
  const careerOptions = matches.filter(
    (match) => !match.isCurrent && match.rankOrder < 900,
  );

  return { diagnosis, matches, currentOccupation, careerOptions };
}

export async function loadContact(candidateId: string) {
  const db = await getDb();
  const [contact] = await db
    .select()
    .from(candidateContacts)
    .where(eq(candidateContacts.candidateId, candidateId))
    .limit(1);
  return contact ?? null;
}

export async function loadBooking(candidateId: string) {
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(interviewBookings)
    .where(eq(interviewBookings.candidateId, candidateId))
    .orderBy(desc(interviewBookings.createdAt))
    .limit(1);
  return booking ?? null;
}
