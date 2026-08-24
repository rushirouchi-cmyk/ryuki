import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { resolveAttribution } from '@/domain/attribution';
import type { LeadRegistration } from '@/domain/diagnosis/input-schema';
import { generateToken, visitorHash } from '@/server/tokens';
import { recordCandidateEvent } from './events';

export interface RegisterScanParams {
  qrToken?: string | null;
  /** existing anonymous candidate carried by the device cookie */
  existingCandidateId?: string | null;
  visitorParts?: (string | null | undefined)[];
}

export interface ScanResult {
  candidateId: string;
  publicToken: string;
  /** true when this scan is the one that locked in the acquisition owner */
  attributed: boolean;
  qrValid: boolean;
}

/**
 * Creates (or reuses) the anonymous candidate and locks attribution.
 * Attribution is written once, at first scan — later scans of a different rep's
 * QR code leave the original owner in place.
 */
export async function registerScan(params: RegisterScanParams): Promise<ScanResult> {
  const db = getDb();

  const qr = params.qrToken
    ? await db.query.qrCodes.findFirst({ where: eq(schema.qrCodes.token, params.qrToken) })
    : undefined;

  const candidate = await ensureCandidate(params.existingCandidateId);

  let attributed = false;
  if (qr && qr.active) {
    const existing = await db.query.candidateAttributions.findFirst({
      where: eq(schema.candidateAttributions.candidateId, candidate.id),
    });
    const decision = resolveAttribution(
      existing
        ? {
            candidateId: existing.candidateId,
            source: existing.source,
            attributedAt: existing.attributedAt,
            qrCodeId: existing.qrCodeId ?? undefined,
            salesUserId: existing.salesUserId ?? undefined,
            shiftId: existing.shiftId ?? undefined,
            locationId: existing.locationId ?? undefined,
          }
        : null,
      {
        qrCodeId: qr.id,
        salesUserId: qr.salesUserId,
        shiftId: qr.shiftId,
        locationId: qr.locationId,
      },
    );
    if (decision.action === 'create') {
      await db
        .insert(schema.candidateAttributions)
        .values({ candidateId: candidate.id, ...decision.value })
        .onConflictDoNothing();
      attributed = true;
    }

    await db.insert(schema.scanEvents).values({
      qrCodeId: qr.id,
      candidateId: candidate.id,
      visitorHash: visitorHash(params.visitorParts ?? []),
    });
    await recordCandidateEvent({
      candidateId: candidate.id,
      eventType: 'qr_scanned',
      metadata: { qrCodeId: qr.id, firstAttribution: attributed },
    });
  }

  return {
    candidateId: candidate.id,
    publicToken: candidate.publicToken,
    attributed,
    qrValid: Boolean(qr?.active),
  };
}

async function ensureCandidate(existingCandidateId?: string | null) {
  const db = getDb();
  const existing = existingCandidateId
    ? await db.query.candidates.findFirst({ where: eq(schema.candidates.id, existingCandidateId) })
    : undefined;
  if (existing) return existing;

  const inserted = await db
    .insert(schema.candidates)
    .values({ publicToken: generateToken(18), status: 'anonymous' })
    .returning();
  const candidate = inserted[0];
  if (!candidate) throw new Error('候補者レコードの作成に失敗しました。');
  return candidate;
}

/** Records the funnel step where the questionnaire is actually opened. */
export async function beginDiagnosis(existingCandidateId?: string | null): Promise<string> {
  const candidate = await ensureCandidate(existingCandidateId);
  const db = getDb();
  const alreadyStarted = await db.query.candidateEvents.findFirst({
    where: and(
      eq(schema.candidateEvents.candidateId, candidate.id),
      eq(schema.candidateEvents.eventType, 'diagnosis_started'),
    ),
  });
  if (!alreadyStarted) {
    await recordCandidateEvent({ candidateId: candidate.id, eventType: 'diagnosis_started' });
  }
  return candidate.id;
}

export async function registerLead(candidateId: string, data: LeadRegistration): Promise<void> {
  const db = getDb();
  const candidate = await db.query.candidates.findFirst({
    where: eq(schema.candidates.id, candidateId),
  });
  if (!candidate) throw new Error('候補者が見つかりません。');

  await db
    .update(schema.candidates)
    .set({
      fullName: data.fullName,
      email: data.email.trim().toLowerCase(),
      phone: data.phone,
      birthYear: data.birthYear ?? null,
      status: candidate.status === 'anonymous' ? 'lead' : 'lead',
      leadRegisteredAt: candidate.leadRegisteredAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.candidates.id, candidateId));

  if (!candidate.leadRegisteredAt) {
    await recordCandidateEvent({
      candidateId,
      eventType: 'lead_registered',
      qualified: candidate.qualified,
    });
  }
}

export async function bookInterview(params: {
  candidateId: string;
  scheduledAt: Date;
  mode: string;
  notes?: string;
}): Promise<string> {
  const db = getDb();
  const inserted = await db
    .insert(schema.interviews)
    .values({
      candidateId: params.candidateId,
      scheduledAt: params.scheduledAt,
      mode: params.mode,
      notes: params.notes,
    })
    .returning();
  const interview = inserted[0];
  if (!interview) throw new Error('面談予約の作成に失敗しました。');

  await db
    .update(schema.candidates)
    .set({ status: 'interview_booked', updatedAt: new Date() })
    .where(eq(schema.candidates.id, params.candidateId));

  await recordCandidateEvent({
    candidateId: params.candidateId,
    eventType: 'interview_booked',
    metadata: { interviewId: interview.id, scheduledAt: params.scheduledAt.toISOString() },
  });

  return interview.id;
}

export async function completeInterview(interviewId: string, notes?: string): Promise<void> {
  const db = getDb();
  const interview = await db.query.interviews.findFirst({
    where: eq(schema.interviews.id, interviewId),
  });
  if (!interview) throw new Error('面談が見つかりません。');
  if (interview.status === 'completed') return;

  await db
    .update(schema.interviews)
    .set({ status: 'completed', completedAt: new Date(), notes: notes ?? interview.notes })
    .where(eq(schema.interviews.id, interviewId));

  await db
    .update(schema.candidates)
    .set({ status: 'interview_completed', updatedAt: new Date() })
    .where(eq(schema.candidates.id, interview.candidateId));

  await recordCandidateEvent({
    candidateId: interview.candidateId,
    eventType: 'interview_completed',
    metadata: { interviewId },
  });
}

export async function getCandidateByPublicToken(token: string) {
  return getDb().query.candidates.findFirst({ where: eq(schema.candidates.publicToken, token) });
}
