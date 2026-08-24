import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  candidateEvents,
  candidates,
  diagnoses,
  locations,
  shifts,
} from "@/lib/db/schema";
import { accrueIncentive } from "@/lib/domain/incentive/service";
import type { MatchRank } from "@/lib/domain/diagnosis/types";

export const CANDIDATE_EVENT_TYPES = [
  "qr_scanned",
  "diagnosis_started",
  "diagnosis_completed",
  "lead_registered",
  "interview_booked",
  "interview_completed",
  "candidate_qualified",
  "agent_recommended",
  "consent_given",
  "agent_referred",
  "agent_accepted",
  "agent_declined",
  "agent_interview_completed",
  "applied",
  "offer_received",
  "joined",
  "lost",
] as const;

export type CandidateEventType = (typeof CANDIDATE_EVENT_TYPES)[number];

export interface EmitEventInput {
  candidateId: string;
  eventType: CandidateEventType;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

/**
 * Single entry point for the funnel.
 *
 * Every stage transition goes through here so that (a) `candidate_events` stays
 * a complete, append-only history the analytics layer can be rebuilt from, and
 * (b) sales incentives are accrued exactly once, from the same transaction path
 * as the event itself.
 */
export async function emitCandidateEvent(
  db: Database,
  input: EmitEventInput,
): Promise<void> {
  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, input.candidateId),
    columns: {
      id: true,
      salesUserId: true,
      shiftId: true,
      locationId: true,
    },
  });
  if (!candidate) throw new Error(`unknown candidate: ${input.candidateId}`);

  const occurredAt = input.occurredAt ?? new Date();

  await db.insert(candidateEvents).values({
    candidateId: candidate.id,
    eventType: input.eventType,
    userId: input.userId ?? null,
    shiftId: candidate.shiftId,
    locationId: candidate.locationId,
    metadata: input.metadata ?? null,
    createdAt: occurredAt,
  });

  await accrueIncentive(db, {
    salesUserId: candidate.salesUserId,
    candidateId: candidate.id,
    shiftId: candidate.shiftId,
    eventType: input.eventType,
    occurredAt,
    context: await buildIncentiveContext(db, candidate.id, candidate.shiftId),
  });
}

async function buildIncentiveContext(
  db: Database,
  candidateId: string,
  shiftId: number | null,
): Promise<{
  matchRank: MatchRank | null;
  venueType: string | null;
  currentSalaryYen: number | null;
}> {
  const [latestDiagnosis] = await db
    .select({
      matchRank: diagnoses.matchRank,
      currentSalaryYen: diagnoses.currentSalaryYen,
    })
    .from(diagnoses)
    .where(eq(diagnoses.candidateId, candidateId))
    .orderBy(desc(diagnoses.startedAt))
    .limit(1);

  let venueType: string | null = null;
  if (shiftId !== null) {
    const [row] = await db
      .select({ venueType: locations.venueType })
      .from(shifts)
      .innerJoin(locations, eq(shifts.locationId, locations.id))
      .where(eq(shifts.id, shiftId))
      .limit(1);
    venueType = row?.venueType ?? null;
  }

  return {
    matchRank: (latestDiagnosis?.matchRank as MatchRank | null) ?? null,
    currentSalaryYen: latestDiagnosis?.currentSalaryYen ?? null,
    venueType,
  };
}

export async function listCandidateEvents(db: Database, candidateId: string) {
  return db
    .select()
    .from(candidateEvents)
    .where(eq(candidateEvents.candidateId, candidateId))
    .orderBy(candidateEvents.createdAt);
}
