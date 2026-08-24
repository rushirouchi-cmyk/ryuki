import { describe, expect, it } from 'vitest';
import { computeRates, computeUnitEconomics, countFunnel, safeRate, type AcquisitionCounts } from './funnel';
import { computeAreaScore } from './area-score';
import { dayOfWeekLabel, resolveTimeBand, splitShiftHoursByBand } from './time-bands';
import { DEFAULT_ANALYTICS_CONFIG } from '@/domain/config/analytics-config';

describe('countFunnel', () => {
  it('counts distinct candidates per stage, not raw events', () => {
    const counts = countFunnel([
      { candidateId: 'a', eventType: 'qr_scanned' },
      { candidateId: 'a', eventType: 'qr_scanned' },
      { candidateId: 'a', eventType: 'diagnosis_started' },
      { candidateId: 'b', eventType: 'qr_scanned' },
      { candidateId: 'b', eventType: 'diagnosis_started' },
      { candidateId: 'b', eventType: 'diagnosis_completed' },
      { candidateId: 'b', eventType: 'lead_registered' },
    ]);
    expect(counts.qr_scanned).toBe(2);
    expect(counts.diagnosis_started).toBe(2);
    expect(counts.diagnosis_completed).toBe(1);
    expect(counts.lead_registered).toBe(1);
    expect(counts.joined).toBe(0);
  });

  it('ignores event types that are not part of the funnel', () => {
    const counts = countFunnel([{ candidateId: 'a', eventType: 'consent_given' }]);
    expect(counts.qr_scanned).toBe(0);
  });
});

const counts: AcquisitionCounts = {
  ...countFunnel([
    ...Array.from({ length: 100 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'qr_scanned' })),
    ...Array.from({ length: 80 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'diagnosis_started' })),
    ...Array.from({ length: 60 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'diagnosis_completed' })),
    ...Array.from({ length: 30 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'lead_registered' })),
    ...Array.from({ length: 20 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'interview_booked' })),
    ...Array.from({ length: 10 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'interview_completed' })),
    ...Array.from({ length: 24 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'candidate_qualified' })),
    ...Array.from({ length: 6 }, (_, i) => ({ candidateId: `c${i}`, eventType: 'agent_referred' })),
  ]),
  approaches: 1000,
  stops: 250,
  salesHours: 40,
};

describe('computeRates', () => {
  it('derives each stage-to-stage conversion', () => {
    const rates = computeRates(counts);
    expect(rates.stopRate).toBeCloseTo(0.25, 5);
    expect(rates.scanRate).toBeCloseTo(0.4, 5);
    expect(rates.diagnosisCompletionRate).toBeCloseTo(0.75, 5);
    expect(rates.registrationRate).toBeCloseTo(0.5, 5);
    expect(rates.interviewBookingRate).toBeCloseTo(20 / 30, 5);
    expect(rates.interviewAttendanceRate).toBeCloseTo(0.5, 5);
    expect(rates.qualifiedRate).toBeCloseTo(24 / 60, 5);
    expect(rates.referralRate).toBeCloseTo(6 / 24, 5);
  });

  it('never divides by zero', () => {
    expect(safeRate(5, 0)).toBe(0);
    const empty = computeRates({ ...counts, approaches: 0, stops: 0 });
    expect(empty.stopRate).toBe(0);
    expect(empty.scanRate).toBe(0);
  });
});

describe('computeUnitEconomics', () => {
  const economics = computeUnitEconomics(
    { salesHours: 40, estimatedRevenue: 300_000, confirmedRevenue: 120_000, incentiveAmount: 45_000, counts },
    DEFAULT_ANALYTICS_CONFIG,
  );

  it('includes wages and other acquisition cost in the margin', () => {
    // 40h * 1200 wage + 40h * 500 other + 45,000 incentive
    expect(economics.baseWageCost).toBe(48_000);
    expect(economics.otherAcquisitionCost).toBe(20_000);
    expect(economics.totalCost).toBe(113_000);
    expect(economics.contributionMargin).toBe(187_000);
  });

  it('reports per-sales-hour and per-stage unit costs', () => {
    expect(economics.revenuePerSalesHour).toBeCloseTo(7_500, 5);
    expect(economics.grossProfitPerSalesHour).toBeCloseTo(4_675, 5);
    expect(economics.costPerLead).toBeCloseTo(113_000 / 30, 5);
    expect(economics.costPerQualified).toBeCloseTo(113_000 / 24, 5);
    expect(economics.revenuePerReferral).toBeCloseTo(300_000 / 6, 5);
  });

  it('keeps confirmed revenue separate from estimated revenue', () => {
    expect(economics.confirmedRevenue).toBe(120_000);
    expect(economics.estimatedRevenue).toBe(300_000);
  });

  it('can go negative when acquisition costs exceed revenue', () => {
    const loss = computeUnitEconomics(
      { salesHours: 40, estimatedRevenue: 10_000, confirmedRevenue: 0, incentiveAmount: 45_000, counts },
      DEFAULT_ANALYTICS_CONFIG,
    );
    expect(loss.contributionMargin).toBeLessThan(0);
    expect(loss.grossProfitPerSalesHour).toBeLessThan(0);
  });
});

describe('computeAreaScore', () => {
  const rates = computeRates(counts);

  it('scores a strong area higher than a weak one', () => {
    const strong = computeAreaScore(
      { approachesPerHour: 25, grossProfitPerSalesHour: 6000, rates, salesHours: 40, approaches: 1000 },
      DEFAULT_ANALYTICS_CONFIG,
    );
    const weak = computeAreaScore(
      { approachesPerHour: 8, grossProfitPerSalesHour: -500, rates, salesHours: 40, approaches: 1000 },
      DEFAULT_ANALYTICS_CONFIG,
    );
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(weak.score).toBeGreaterThanOrEqual(0);
  });

  it('flags small samples so a lucky n=7 is not mistaken for a proven area', () => {
    const tiny = computeAreaScore(
      { approachesPerHour: 30, grossProfitPerSalesHour: 9000, rates, salesHours: 2, approaches: 7 },
      DEFAULT_ANALYTICS_CONFIG,
    );
    expect(tiny.lowConfidence).toBe(true);
    expect(tiny.sampleApproaches).toBe(7);

    const proven = computeAreaScore(
      { approachesPerHour: 30, grossProfitPerSalesHour: 9000, rates, salesHours: 100, approaches: 500 },
      DEFAULT_ANALYTICS_CONFIG,
    );
    expect(proven.lowConfidence).toBe(false);
  });

  it('honours reconfigured weights', () => {
    const profitOnly = computeAreaScore(
      { approachesPerHour: 1, grossProfitPerSalesHour: 8000, rates, salesHours: 40, approaches: 1000 },
      {
        ...DEFAULT_ANALYTICS_CONFIG,
        areaScoreWeights: {
          approachesPerHour: 0,
          stopRate: 0,
          scanRate: 0,
          diagnosisCompletionRate: 0,
          leadRate: 0,
          interviewRate: 0,
          qualifiedRate: 0,
          referralRate: 0,
          grossProfitPerSalesHour: 1,
        },
      },
    );
    expect(profitOnly.score).toBe(100);
  });
});

describe('time bands', () => {
  it('resolves an hour into its configured band', () => {
    const band = resolveTimeBand(new Date('2026-06-06T14:30:00'), DEFAULT_ANALYTICS_CONFIG);
    expect(band?.label).toBe('午後 (13-16)');
  });

  it('returns null outside the configured bands', () => {
    expect(resolveTimeBand(new Date('2026-06-06T04:00:00'), DEFAULT_ANALYTICS_CONFIG)).toBeNull();
  });

  it('labels the day of week in Japanese', () => {
    expect(dayOfWeekLabel(new Date('2026-06-06T12:00:00'))).toBe('土');
  });

  it('splits a shift across every band it overlaps', () => {
    const parts = splitShiftHoursByBand(
      new Date('2026-06-06T10:00:00'),
      new Date('2026-06-06T16:00:00'),
      DEFAULT_ANALYTICS_CONFIG,
    );
    const total = parts.reduce((sum, part) => sum + part.hours, 0);
    expect(parts.map((p) => p.band)).toEqual(['午前 (9-11)', '昼前 (11-13)', '午後 (13-16)']);
    expect(total).toBeCloseTo(6, 5);
  });
});
