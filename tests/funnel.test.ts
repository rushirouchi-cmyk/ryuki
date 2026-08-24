import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { candidates, referrals, revenueEvents } from "@/lib/db/schema";
import {
  bookInterview,
  completeDiagnosis,
  completeInterview,
  handleQrScan,
  registerLead,
  startDiagnosis,
} from "@/lib/domain/candidates/service";
import { buildRecommendations, referCandidate, updateReferralStatus } from "@/lib/domain/agents/service";
import { getBreakdown, getOverview } from "@/lib/analytics/queries";
import { getShiftMetrics } from "@/lib/analytics/shift";
import { computeRates } from "@/lib/analytics/metrics";
import type { DiagnosisAnswers } from "@/lib/domain/diagnosis/questionnaire";
import { createTestDb } from "./helpers/db";
import { seedFixtures, type Fixtures } from "./helpers/fixtures";

const ALL_TIME = { from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) };

describe("funnel aggregation from the event log", () => {
  let db: Database;
  let cleanup: () => void;
  let fixtures: Fixtures;

  function answers(): DiagnosisAnswers {
    return {
      currentSalaryBand: "400_450",
      currentOccupationId: fixtures.mechanicId,
      currentIndustry: "automotive",
      experienceBand: "6-9",
      skillIds: [
        fixtures.skills.fault_diagnosis!,
        fixtures.skills.machine_maintenance!,
        fixtures.skills.customer_support!,
      ],
      certificationIds: [
        fixtures.certifications.mechanic_2!,
        fixtures.certifications.driver_license!,
      ],
      managementBand: "none",
      employmentType: "full_time",
      currentRegionId: fixtures.regionId,
      desiredRegionIds: [fixtures.regionId],
      relocationOk: false,
      travelOk: true,
      nightShiftOk: false,
      educationLevel: "vocational",
      desiredConditions: ["salary_up"],
      desiredTiming: "3_6m",
    } as DiagnosisAnswers;
  }

  /** Walks one candidate the whole way: scan -> diagnosis -> lead -> referral. */
  async function runFullJourney(): Promise<string> {
    const scan = await handleQrScan(db, fixtures.qrToken, null);
    if (!scan) throw new Error("scan failed");

    const { diagnosisId } = await startDiagnosis(db, scan.candidateId);
    await completeDiagnosis(db, scan.candidateId, diagnosisId, answers());
    await registerLead(db, scan.candidateId, {
      fullName: "テスト 太郎",
      email: "taro@example.com",
      phone: "090-0000-0000",
    });
    const bookingId = await bookInterview(
      db,
      scan.candidateId,
      new Date(Date.now() + 86_400_000),
      "明日 11:00",
    );
    await completeInterview(db, bookingId, fixtures.adminUserId);
    await buildRecommendations(db, scan.candidateId);
    await referCandidate(db, scan.candidateId, [fixtures.agentCompanyId]);
    return scan.candidateId;
  }

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    fixtures = await seedFixtures(db);
    await runFullJourney();

    /* A second candidate who drops out right after the diagnosis. */
    const dropout = await handleQrScan(db, fixtures.qrToken, null);
    const { diagnosisId } = await startDiagnosis(db, dropout!.candidateId);
    await completeDiagnosis(db, dropout!.candidateId, diagnosisId, answers());

    /* A third who only scans. */
    await handleQrScan(db, fixtures.qrToken, null);
  }, 120_000);

  afterAll(() => cleanup());

  it("counts every funnel step from candidate_events", async () => {
    const { funnel } = await getOverview(db, ALL_TIME);

    expect(funnel.scans).toBe(3);
    expect(funnel.diagnosisStarted).toBe(2);
    expect(funnel.diagnosisCompleted).toBe(2);
    expect(funnel.leads).toBe(1);
    expect(funnel.interviewBooked).toBe(1);
    expect(funnel.interviewCompleted).toBe(1);
    expect(funnel.qualified).toBe(1);
    expect(funnel.referrals).toBe(1);
  });

  it("derives conversion rates from those counts", async () => {
    const { funnel } = await getOverview(db, ALL_TIME);
    const rates = computeRates(funnel);

    expect(rates.diagnosisStartRate).toBeCloseTo(2 / 3, 5);
    expect(rates.diagnosisCompletionRate).toBe(1);
    expect(rates.registrationRate).toBe(0.5);
    expect(rates.interviewBookingRate).toBe(1);
  });

  it("returns null rather than a fake rate when the denominator is zero", async () => {
    const rates = computeRates({
      salesHours: 0,
      approaches: 0,
      stops: 0,
      scans: 0,
      diagnosisStarted: 0,
      diagnosisCompleted: 0,
      leads: 0,
      interviewBooked: 0,
      interviewCompleted: 0,
      qualified: 0,
      referrals: 0,
      offers: 0,
      joins: 0,
    });
    expect(rates.stopRate).toBeNull();
    expect(rates.registrationRate).toBeNull();
  });

  it("attributes the funnel to the acquiring shift, rep and location", async () => {
    const byRep = await getBreakdown(db, ALL_TIME, "sales_user");
    const acquiring = byRep.find((row) => row.label === "営業A");
    const other = byRep.find((row) => row.label === "営業B");
    expect(acquiring?.funnel.leads).toBe(1);
    expect(acquiring?.funnel.scans).toBe(3);
    /* The rep who ran no candidates gets none of the credit. */
    expect(other?.funnel.leads ?? 0).toBe(0);
    expect(other?.funnel.scans ?? 0).toBe(0);

    const [byLocation] = await getBreakdown(db, ALL_TIME, "location");
    expect(byLocation?.label).toBe("テスト会場");
    expect(byLocation?.funnel.scans).toBe(3);
  });

  it("reports the same numbers on the shift the candidates came from", async () => {
    const metrics = (await getShiftMetrics(db, [fixtures.shiftId])).get(fixtures.shiftId);
    expect(metrics?.scanCount).toBe(3);
    expect(metrics?.diagnosisCompleted).toBe(2);
    expect(metrics?.leadRegistered).toBe(1);
    expect(metrics?.referralCount).toBe(1);
    expect(metrics?.incentiveYen).toBeGreaterThan(0);
  });

  it("excludes events outside the requested period", async () => {
    const { funnel } = await getOverview(db, {
      from: new Date(2000, 0, 1),
      to: new Date(2000, 0, 2),
    });
    expect(funnel.scans).toBe(0);
    expect(funnel.leads).toBe(0);
  });

  it("advances the outcome stage and books revenue when an agency reports a join", async () => {
    const [referral] = await db.select().from(referrals).limit(1);
    if (!referral) throw new Error("no referral");

    await updateReferralStatus(db, referral.id, "interview_completed", null);
    await updateReferralStatus(db, referral.id, "joined", null, {
      offerCompany: "テスト株式会社",
      offerSalaryYen: 5_600_000,
      joinedDate: "2026-08-01",
    });

    const events = await db
      .select()
      .from(revenueEvents)
      .where(eq(revenueEvents.referralId, referral.id));
    const byType = new Map(events.map((event) => [event.eventType, event.amountYen]));
    expect(byType.get("agent_interview_completed")).toBe(30_000);
    expect(byType.get("joined")).toBe(400_000);

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, referral.candidateId));
    expect(candidate?.stage).toBe("outcome");

    const { funnel, financials } = await getOverview(db, ALL_TIME);
    expect(funnel.joins).toBe(1);
    expect(financials.estimatedRevenueYen).toBe(430_000);
    expect(financials.confirmedRevenueYen).toBe(0);
  });

  it("counts revenue as confirmed only once an admin confirms it", async () => {
    await db.update(revenueEvents).set({ status: "confirmed" });
    const { financials } = await getOverview(db, ALL_TIME);
    expect(financials.confirmedRevenueYen).toBe(430_000);
  });
});
