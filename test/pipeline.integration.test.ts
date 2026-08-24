/**
 * End-to-end pipeline test against a real PostgreSQL instance.
 *
 * Verifies the guarantees that unit tests cannot: first-valid attribution across
 * two different reps' QR codes, one incentive row per (candidate, event) even
 * under repeated events, and a funnel derived purely from candidate_events.
 *
 * Skipped automatically when DATABASE_URL is not configured.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, getPool, schema } from '@/db/client';
import { generateToken } from '@/server/tokens';
import { hashPassword } from '@/server/password';
import { beginDiagnosis, registerScan } from '@/server/services/candidates';
import { completeDiagnosis, loadDiagnosisMasters } from '@/server/services/diagnosis';
import { recordCandidateEvent } from '@/server/services/events';
import { countFunnel } from '@/domain/analytics/funnel';
import type { DiagnosisAnswers } from '@/domain/diagnosis/input-schema';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('candidate pipeline (integration)', () => {
  const db = getDb();
  const created = {
    userIds: [] as string[],
    locationId: '',
    shiftIds: [] as string[],
    qrTokens: [] as string[],
    candidateIds: [] as string[],
    ruleIds: [] as string[],
  };

  let occupationId = '';
  let candidateId = '';
  let repAId = '';
  let repBId = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword('integration-test');
    const users = await db
      .insert(schema.users)
      .values([
        {
          email: `it-rep-a-${Date.now()}@example.test`,
          passwordHash,
          displayName: 'IT Rep A',
          role: 'sales',
        },
        {
          email: `it-rep-b-${Date.now()}@example.test`,
          passwordHash,
          displayName: 'IT Rep B',
          role: 'sales',
        },
      ])
      .returning();
    repAId = users[0]?.id ?? '';
    repBId = users[1]?.id ?? '';
    created.userIds = users.map((user) => user.id);

    const locations = await db
      .insert(schema.locations)
      .values({
        prefecture: '大阪府',
        city: 'テスト市',
        venueName: `IT Venue ${Date.now()}`,
        venueType: 'shopping_mall',
      })
      .returning();
    created.locationId = locations[0]?.id ?? '';

    const shifts = await db
      .insert(schema.shifts)
      .values([
        {
          salesUserId: repAId,
          locationId: created.locationId,
          startTime: new Date(),
          venueType: 'shopping_mall',
        },
        {
          salesUserId: repBId,
          locationId: created.locationId,
          startTime: new Date(),
          venueType: 'shopping_mall',
        },
      ])
      .returning();
    created.shiftIds = shifts.map((shift) => shift.id);

    const tokenA = generateToken(12);
    const tokenB = generateToken(12);
    created.qrTokens = [tokenA, tokenB];
    await db.insert(schema.qrCodes).values([
      {
        token: tokenA,
        shiftId: created.shiftIds[0] ?? '',
        salesUserId: repAId,
        locationId: created.locationId,
      },
      {
        token: tokenB,
        shiftId: created.shiftIds[1] ?? '',
        salesUserId: repBId,
        locationId: created.locationId,
      },
    ]);

    const occupation = await db.query.occupations.findFirst();
    occupationId = occupation?.id ?? '';
  });

  afterAll(async () => {
    if (created.candidateIds.length > 0) {
      await db.delete(schema.candidates).where(inArray(schema.candidates.id, created.candidateIds));
    }
    if (created.qrTokens.length > 0) {
      await db.delete(schema.qrCodes).where(inArray(schema.qrCodes.token, created.qrTokens));
    }
    if (created.shiftIds.length > 0) {
      await db.delete(schema.shifts).where(inArray(schema.shifts.id, created.shiftIds));
    }
    if (created.locationId) {
      await db.delete(schema.locations).where(eq(schema.locations.id, created.locationId));
    }
    if (created.ruleIds.length > 0) {
      await db.delete(schema.incentiveRules).where(inArray(schema.incentiveRules.id, created.ruleIds));
    }
    if (created.userIds.length > 0) {
      await db.delete(schema.users).where(inArray(schema.users.id, created.userIds));
    }
    await getPool().end();
  });

  it('locks attribution to the first rep whose QR was scanned', async () => {
    const first = await registerScan({ qrToken: created.qrTokens[0] });
    candidateId = first.candidateId;
    created.candidateIds.push(candidateId);
    expect(first.attributed).toBe(true);
    expect(first.qrValid).toBe(true);

    // The same person now scans a second rep's QR code on the same device.
    const second = await registerScan({
      qrToken: created.qrTokens[1],
      existingCandidateId: candidateId,
    });
    expect(second.candidateId).toBe(candidateId);
    expect(second.attributed).toBe(false);

    const attribution = await db.query.candidateAttributions.findFirst({
      where: eq(schema.candidateAttributions.candidateId, candidateId),
    });
    expect(attribution?.salesUserId).toBe(repAId);
    expect(attribution?.shiftId).toBe(created.shiftIds[0]);
    expect(attribution?.locationId).toBe(created.locationId);
  });

  it('records both scans while keeping one attribution row', async () => {
    const scans = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.scanEvents)
      .where(eq(schema.scanEvents.candidateId, candidateId));
    expect(scans[0]?.count).toBe(2);

    const attributions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.candidateAttributions)
      .where(eq(schema.candidateAttributions.candidateId, candidateId));
    expect(attributions[0]?.count).toBe(1);
  });

  it('records diagnosis_started only once even if the page is reopened', async () => {
    await beginDiagnosis(candidateId);
    await beginDiagnosis(candidateId);

    const events = await db.query.candidateEvents.findMany({
      where: and(
        eq(schema.candidateEvents.candidateId, candidateId),
        eq(schema.candidateEvents.eventType, 'diagnosis_started'),
      ),
    });
    expect(events).toHaveLength(1);
  });

  it('persists an explainable diagnosis and attaches it to the same candidate id', async () => {
    const masters = await loadDiagnosisMasters();
    expect(masters.occupations.length).toBeGreaterThan(0);

    const answers: DiagnosisAnswers = {
      salaryBand: '400_449',
      occupationId,
      industry: '機械・電機',
      experienceYears: 7,
      certificationIds: masters.certifications.slice(0, 2).map((cert) => cert.id),
      skillIds: masters.occupationSkills
        .filter((link) => link.occupationId === occupationId)
        .map((link) => link.skillId),
      hasManagementExperience: true,
      employmentType: 'full_time',
      currentPrefecture: '大阪府',
      desiredPrefectures: ['大阪府'],
      relocationOk: true,
      businessTripOk: true,
      nightShiftOk: true,
      educationLevel: 'vocational',
      desiredConditions: ['年収アップ'],
      ageBand: '30代前半',
      jobChangeTiming: '3〜6ヶ月',
    };

    const result = await completeDiagnosis({ candidateId, answers });
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.estimatedSalaryHigh % 100_000).toBe(0);

    const stored = await db.query.diagnoses.findFirst({
      where: eq(schema.diagnoses.candidateId, candidateId),
    });
    expect(stored).toBeTruthy();
    expect(stored?.configSnapshot).toBeTruthy();

    const matches = await db.query.diagnosisOccupationMatches.findMany({
      where: eq(schema.diagnosisOccupationMatches.diagnosisId, stored?.id ?? ''),
    });
    expect(matches.length).toBe(result.options.length);

    const candidate = await db.query.candidates.findFirst({
      where: eq(schema.candidates.id, candidateId),
    });
    expect(candidate?.status).toBe('diagnosed');
    expect(candidate?.prefecture).toBe('大阪府');
  });

  it('credits the incentive to the attributed rep only, exactly once', async () => {
    const rule = await db
      .insert(schema.incentiveRules)
      .values({
        eventType: 'agent_interview_completed',
        amount: 4_321,
        description: 'integration test rule',
        validFrom: new Date(Date.now() - 86_400_000),
      })
      .returning();
    created.ruleIds.push(rule[0]?.id ?? '');

    // The same milestone reported twice must not pay twice.
    await recordCandidateEvent({ candidateId, eventType: 'agent_interview_completed' });
    await recordCandidateEvent({ candidateId, eventType: 'agent_interview_completed' });

    const entries = await db.query.incentiveLedger.findMany({
      where: and(
        eq(schema.incentiveLedger.candidateId, candidateId),
        eq(schema.incentiveLedger.eventType, 'agent_interview_completed'),
      ),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.amount).toBe(4_321);
    expect(entries[0]?.salesUserId).toBe(repAId);
    expect(entries[0]?.shiftId).toBe(created.shiftIds[0]);

    const forRepB = await db.query.incentiveLedger.findMany({
      where: eq(schema.incentiveLedger.salesUserId, repBId),
    });
    expect(forRepB).toHaveLength(0);
  });

  it('rebuilds the funnel from the event log alone', async () => {
    const events = await db
      .select({
        candidateId: schema.candidateEvents.candidateId,
        eventType: schema.candidateEvents.eventType,
      })
      .from(schema.candidateEvents)
      .where(eq(schema.candidateEvents.candidateId, candidateId));

    const funnel = countFunnel(events);
    expect(funnel.qr_scanned).toBe(1); // distinct candidates, not raw scans
    expect(funnel.diagnosis_started).toBe(1);
    expect(funnel.diagnosis_completed).toBe(1);
    expect(funnel.lead_registered).toBe(0);
  });
});
