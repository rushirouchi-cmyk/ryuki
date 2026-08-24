import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  candidateContacts,
  candidateEvents,
  candidates,
  diagnoses,
  diagnosisCertifications,
  diagnosisOccupationMatches,
  diagnosisSkills,
  interviewBookings,
  qrCodes,
  scanEvents,
  shifts,
} from "@/lib/db/schema";
import { getDiagnosisConfig, getQualificationConfig } from "@/lib/config/store";
import { resolveAttribution, type Attribution } from "@/lib/domain/attribution/engine";
import { runDiagnosis } from "@/lib/domain/diagnosis/engine";
import { loadDiagnosisMasterData } from "@/lib/domain/diagnosis/repository";
import { experienceBandFor } from "@/lib/domain/diagnosis/scoring";
import {
  salaryFromBand,
  yearsFromExperienceBand,
  yearsFromManagementBand,
  type DiagnosisAnswers,
} from "@/lib/domain/diagnosis/questionnaire";
import type {
  CandidateProfile,
  EducationLevel,
  EmploymentType,
  MatchRank,
} from "@/lib/domain/diagnosis/types";
import { emitCandidateEvent } from "@/lib/domain/events/service";
import { generateToken } from "@/lib/utils/token";

const RANK_ORDER: Record<MatchRank, number> = { C: 0, B: 1, A: 2, S: 3 };

export interface ScanOutcome {
  candidateId: string;
  publicToken: string;
  created: boolean;
  attributed: boolean;
}

/**
 * Entry point for `/d/{token}`.
 *
 * A candidate row is created on the very first scan so that the QR-scan step of
 * the funnel is attributable even for someone who never starts the diagnosis.
 * Re-scanning another rep's code never moves the attribution.
 */
export async function handleQrScan(
  db: Database,
  qrToken: string,
  existingPublicToken: string | null,
  at: Date = new Date(),
): Promise<ScanOutcome | null> {
  const [qr] = await db
    .select({
      id: qrCodes.id,
      shiftId: qrCodes.shiftId,
      salesUserId: qrCodes.salesUserId,
      locationId: qrCodes.locationId,
      active: qrCodes.active,
    })
    .from(qrCodes)
    .where(eq(qrCodes.token, qrToken))
    .limit(1);

  if (!qr || !qr.active) return null;

  const incoming: Attribution = {
    qrCodeId: qr.id,
    salesUserId: qr.salesUserId,
    shiftId: qr.shiftId,
    locationId: qr.locationId,
    source: "qr",
  };

  const existing = existingPublicToken
    ? await findCandidateByToken(db, existingPublicToken)
    : null;

  if (!existing) {
    const publicToken = generateToken(18);
    const [created] = await db
      .insert(candidates)
      .values({
        publicToken,
        stage: "anonymous",
        qrCodeId: incoming.qrCodeId,
        salesUserId: incoming.salesUserId,
        shiftId: incoming.shiftId,
        locationId: incoming.locationId,
        attributionSource: "qr",
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: candidates.id });

    if (!created) throw new Error("failed to create candidate");

    await db.insert(scanEvents).values({
      qrCodeId: qr.id,
      shiftId: qr.shiftId,
      salesUserId: qr.salesUserId,
      locationId: qr.locationId,
      candidateId: created.id,
      isAttributed: true,
      createdAt: at,
    });
    await emitCandidateEvent(db, {
      candidateId: created.id,
      eventType: "qr_scanned",
      occurredAt: at,
      metadata: { qrCodeId: qr.id },
    });

    return { candidateId: created.id, publicToken, created: true, attributed: true };
  }

  const decision = resolveAttribution(
    {
      qrCodeId: existing.qrCodeId,
      salesUserId: existing.salesUserId,
      shiftId: existing.shiftId,
      locationId: existing.locationId,
      source: existing.attributionSource,
      lockedAt: existing.attributionLockedAt,
    },
    incoming,
  );

  if (decision.changed) {
    await db
      .update(candidates)
      .set({
        qrCodeId: decision.attribution.qrCodeId,
        salesUserId: decision.attribution.salesUserId,
        shiftId: decision.attribution.shiftId,
        locationId: decision.attribution.locationId,
        attributionSource: decision.attribution.source,
        updatedAt: at,
      })
      .where(eq(candidates.id, existing.id));
  }

  await db.insert(scanEvents).values({
    qrCodeId: qr.id,
    shiftId: qr.shiftId,
    salesUserId: qr.salesUserId,
    locationId: qr.locationId,
    candidateId: existing.id,
    isAttributed: decision.changed,
    createdAt: at,
  });

  /* A repeat scan is not a new funnel entry, so no second `qr_scanned` event. */
  return {
    candidateId: existing.id,
    publicToken: existing.publicToken,
    created: false,
    attributed: decision.changed,
  };
}

export async function findCandidateByToken(db: Database, publicToken: string) {
  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.publicToken, publicToken))
    .limit(1);
  return row ?? null;
}

/** Creates an anonymous candidate for someone who reached the LP without a QR. */
export async function createDirectCandidate(db: Database): Promise<ScanOutcome> {
  const publicToken = generateToken(18);
  const [created] = await db
    .insert(candidates)
    .values({ publicToken, stage: "anonymous", attributionSource: "direct" })
    .returning({ id: candidates.id });
  if (!created) throw new Error("failed to create candidate");
  return { candidateId: created.id, publicToken, created: true, attributed: false };
}

/** Freezes attribution and opens a diagnosis. Idempotent per candidate. */
export async function startDiagnosis(
  db: Database,
  candidateId: string,
  at: Date = new Date(),
): Promise<{ diagnosisId: string }> {
  const [open] = await db
    .select({ id: diagnoses.id })
    .from(diagnoses)
    .where(and(eq(diagnoses.candidateId, candidateId), eq(diagnoses.status, "started")))
    .orderBy(desc(diagnoses.startedAt))
    .limit(1);

  if (open) return { diagnosisId: open.id };

  const [created] = await db
    .insert(diagnoses)
    .values({ candidateId, status: "started", startedAt: at, createdAt: at })
    .returning({ id: diagnoses.id });
  if (!created) throw new Error("failed to create diagnosis");

  await db
    .update(candidates)
    .set({ attributionLockedAt: at, updatedAt: at })
    .where(and(eq(candidates.id, candidateId), isNull(candidates.attributionLockedAt)));

  await emitCandidateEvent(db, {
    candidateId,
    eventType: "diagnosis_started",
    occurredAt: at,
  });

  return { diagnosisId: created.id };
}

export function toCandidateProfile(answers: DiagnosisAnswers): CandidateProfile {
  const experienceYears = yearsFromExperienceBand(answers.experienceBand);
  return {
    currentOccupationId: answers.currentOccupationId,
    currentSalaryYen: salaryFromBand(answers.currentSalaryBand),
    experienceYears,
    experienceBand: experienceBandFor(experienceYears),
    educationLevel: answers.educationLevel as EducationLevel,
    employmentType: answers.employmentType as EmploymentType,
    managementYears: yearsFromManagementBand(answers.managementBand),
    skillIds: answers.skillIds,
    certificationIds: answers.certificationIds,
    currentRegionId: answers.currentRegionId,
    desiredRegionIds: answers.desiredRegionIds,
    relocationOk: answers.relocationOk,
    travelOk: answers.travelOk,
    nightShiftOk: answers.nightShiftOk,
  };
}

/** Runs the engine, persists the full breakdown, and advances the funnel. */
export async function completeDiagnosis(
  db: Database,
  candidateId: string,
  diagnosisId: string,
  answers: DiagnosisAnswers,
  at: Date = new Date(),
): Promise<void> {
  const [config, master] = await Promise.all([
    getDiagnosisConfig(db),
    loadDiagnosisMasterData(db),
  ]);

  const profile = toCandidateProfile(answers);
  const result = runDiagnosis(profile, master, config);

  await db
    .update(diagnoses)
    .set({
      status: "completed",
      completedAt: at,
      answers,
      engineVersion: result.engineVersion,
      configSnapshot: config as unknown as Record<string, unknown>,
      currentOccupationId: profile.currentOccupationId,
      currentSalaryYen: profile.currentSalaryYen,
      experienceYears: profile.experienceYears,
      experienceBand: profile.experienceBand,
      educationLevel: profile.educationLevel,
      employmentType: profile.employmentType,
      managementYears: profile.managementYears,
      currentRegionId: profile.currentRegionId,
      desiredRegionIds: profile.desiredRegionIds,
      relocationOk: profile.relocationOk,
      travelOk: profile.travelOk,
      nightShiftOk: profile.nightShiftOk,
      desiredConditions: answers.desiredConditions,
      desiredTiming: answers.desiredTiming,
      currentMarketLow: result.currentMarket?.low ?? null,
      currentMarketMedian: result.currentMarket?.median ?? null,
      currentMarketHigh: result.currentMarket?.high ?? null,
      estimatedSalaryLow: result.estimatedSalaryLow,
      estimatedSalaryHigh: result.estimatedSalaryHigh,
      upliftLow: result.upliftLow,
      upliftHigh: result.upliftHigh,
      bestMatchScore: result.bestMatchScore,
      matchRank: result.matchRank,
      valuedExperiences: result.valuedExperiences,
      dataConfidence: result.dataConfidence,
    })
    .where(eq(diagnoses.id, diagnosisId));

  await db.delete(diagnosisSkills).where(eq(diagnosisSkills.diagnosisId, diagnosisId));
  await db
    .delete(diagnosisCertifications)
    .where(eq(diagnosisCertifications.diagnosisId, diagnosisId));
  await db
    .delete(diagnosisOccupationMatches)
    .where(eq(diagnosisOccupationMatches.diagnosisId, diagnosisId));

  if (profile.skillIds.length > 0) {
    await db
      .insert(diagnosisSkills)
      .values(profile.skillIds.map((skillId) => ({ diagnosisId, skillId })));
  }
  if (profile.certificationIds.length > 0) {
    await db.insert(diagnosisCertifications).values(
      profile.certificationIds.map((certificationId) => ({
        diagnosisId,
        certificationId,
      })),
    );
  }

  const shown = new Set(result.careerOptions.map((option) => option.occupationId));
  await db.insert(diagnosisOccupationMatches).values(
    result.matches.map((match, index) => ({
      diagnosisId,
      occupationId: match.occupationId,
      isCurrent: match.isCurrent,
      matchScore: match.matchScore,
      scoreBreakdown: match.breakdown,
      salaryLow: match.benchmark?.salaryLow ?? null,
      salaryMedian: match.benchmark?.salaryMedian ?? null,
      salaryHigh: match.benchmark?.salaryHigh ?? null,
      benchmarkId: match.benchmark?.id ?? null,
      transitionRuleId: match.transitionRuleId,
      rankOrder: match.isCurrent ? 0 : shown.has(match.occupationId) ? index : 999,
    })),
  );

  await db
    .update(candidates)
    .set({ stage: "diagnosed", updatedAt: at })
    .where(eq(candidates.id, candidateId));

  await emitCandidateEvent(db, {
    candidateId,
    eventType: "diagnosis_completed",
    occurredAt: at,
    metadata: {
      matchRank: result.matchRank,
      bestMatchScore: result.bestMatchScore,
      estimatedSalaryLow: result.estimatedSalaryLow,
      estimatedSalaryHigh: result.estimatedSalaryHigh,
    },
  });
}

export interface LeadRegistrationInput {
  fullName: string;
  fullNameKana?: string | null;
  email: string;
  phone?: string | null;
  birthYear?: number | null;
  preferredContact?: string | null;
}

export async function registerLead(
  db: Database,
  candidateId: string,
  input: LeadRegistrationInput,
  at: Date = new Date(),
): Promise<void> {
  await db
    .insert(candidateContacts)
    .values({
      candidateId,
      fullName: input.fullName,
      fullNameKana: input.fullNameKana ?? null,
      email: input.email,
      phone: input.phone ?? null,
      birthYear: input.birthYear ?? null,
      preferredContact: input.preferredContact ?? null,
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: candidateContacts.candidateId,
      set: {
        fullName: input.fullName,
        fullNameKana: input.fullNameKana ?? null,
        email: input.email,
        phone: input.phone ?? null,
        birthYear: input.birthYear ?? null,
        preferredContact: input.preferredContact ?? null,
        updatedAt: at,
      },
    });

  const alreadyLead = await hasEvent(db, candidateId, "lead_registered");
  await advanceStage(db, candidateId, "lead");
  if (!alreadyLead) {
    /* PII itself is never written to the event log. */
    await emitCandidateEvent(db, {
      candidateId,
      eventType: "lead_registered",
      occurredAt: at,
    });
  }
}

export async function bookInterview(
  db: Database,
  candidateId: string,
  scheduledAt: Date,
  slotLabel: string,
  at: Date = new Date(),
): Promise<number> {
  const [booking] = await db
    .insert(interviewBookings)
    .values({
      candidateId,
      scheduledAt,
      slotLabel,
      status: "booked",
      createdAt: at,
      updatedAt: at,
    })
    .returning({ id: interviewBookings.id });
  if (!booking) throw new Error("failed to create booking");

  await advanceStage(db, candidateId, "interview_booked");
  await emitCandidateEvent(db, {
    candidateId,
    eventType: "interview_booked",
    occurredAt: at,
    metadata: { bookingId: booking.id, scheduledAt: scheduledAt.toISOString() },
  });
  return booking.id;
}

export async function completeInterview(
  db: Database,
  bookingId: number,
  staffUserId: string | null,
  at: Date = new Date(),
): Promise<void> {
  const [booking] = await db
    .select()
    .from(interviewBookings)
    .where(eq(interviewBookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error(`unknown booking: ${bookingId}`);
  if (booking.status === "completed") return;

  await db
    .update(interviewBookings)
    .set({
      status: "completed",
      completedAt: at,
      staffUserId,
      updatedAt: at,
    })
    .where(eq(interviewBookings.id, bookingId));

  await advanceStage(db, booking.candidateId, "interview_completed");
  await emitCandidateEvent(db, {
    candidateId: booking.candidateId,
    eventType: "interview_completed",
    userId: staffUserId,
    occurredAt: at,
    metadata: { bookingId },
  });

  await evaluateQualification(db, booking.candidateId, staffUserId, at);
}

/**
 * "Qualified" is the first point where the business knows a street-acquired
 * candidate is worth an agency's time, so the rule lives in configuration.
 */
export async function evaluateQualification(
  db: Database,
  candidateId: string,
  userId: string | null,
  at: Date = new Date(),
): Promise<boolean> {
  const config = await getQualificationConfig(db);

  const [candidate] = await db
    .select({ qualified: candidates.qualified })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);
  if (!candidate || candidate.qualified) return false;

  const [latest] = await db
    .select({ matchRank: diagnoses.matchRank })
    .from(diagnoses)
    .where(and(eq(diagnoses.candidateId, candidateId), eq(diagnoses.status, "completed")))
    .orderBy(desc(diagnoses.completedAt))
    .limit(1);

  if (!latest?.matchRank) return false;
  if (RANK_ORDER[latest.matchRank] < RANK_ORDER[config.minMatchRank]) return false;

  if (config.requireContact) {
    const [contact] = await db
      .select({ candidateId: candidateContacts.candidateId })
      .from(candidateContacts)
      .where(eq(candidateContacts.candidateId, candidateId))
      .limit(1);
    if (!contact) return false;
  }

  if (config.requireInterviewCompleted) {
    if (!(await hasEvent(db, candidateId, "interview_completed"))) return false;
  }

  await db
    .update(candidates)
    .set({ qualified: true, qualifiedAt: at, updatedAt: at })
    .where(eq(candidates.id, candidateId));
  await advanceStage(db, candidateId, "qualified");
  await emitCandidateEvent(db, {
    candidateId,
    eventType: "candidate_qualified",
    userId,
    occurredAt: at,
  });
  return true;
}

const STAGE_ORDER = [
  "anonymous",
  "diagnosed",
  "lead",
  "interview_booked",
  "interview_completed",
  "qualified",
  "referred",
  "outcome",
] as const;

export type CandidateStage = (typeof STAGE_ORDER)[number];

/** Stage never moves backwards; the event log holds the real history. */
export async function advanceStage(
  db: Database,
  candidateId: string,
  stage: CandidateStage,
): Promise<void> {
  const [current] = await db
    .select({ stage: candidates.stage })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);
  if (!current) return;
  if (STAGE_ORDER.indexOf(current.stage) >= STAGE_ORDER.indexOf(stage)) return;

  await db
    .update(candidates)
    .set({ stage, updatedAt: new Date() })
    .where(eq(candidates.id, candidateId));
}

export async function hasEvent(
  db: Database,
  candidateId: string,
  eventType: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: candidateEvents.id })
    .from(candidateEvents)
    .where(
      and(
        eq(candidateEvents.candidateId, candidateId),
        eq(candidateEvents.eventType, eventType as never),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getShiftForCandidate(db: Database, candidateId: string) {
  const [row] = await db
    .select({ shift: shifts })
    .from(candidates)
    .innerJoin(shifts, eq(candidates.shiftId, shifts.id))
    .where(eq(candidates.id, candidateId))
    .limit(1);
  return row?.shift ?? null;
}
