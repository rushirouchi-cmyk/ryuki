import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb, getPool, schema } from './client';
import { hashPassword } from '@/server/password';
import { generateToken } from '@/server/tokens';
import { runDiagnosis } from '@/domain/diagnosis/engine';
import { evaluateIncentive } from '@/domain/incentive/engine';
import type { IncentiveRule, MonetizableEvent } from '@/domain/incentive/types';
import { DEFAULT_DIAGNOSIS_CONFIG } from '@/domain/config/diagnosis-config';
import { DEFAULT_ANALYTICS_CONFIG } from '@/domain/config/analytics-config';
import { DEFAULT_AGENT_ROUTING_CONFIG } from '@/domain/config/agent-routing-config';
import { DEFAULT_INCENTIVE_CONFIG } from '@/domain/config/incentive-config';
import { SETTING_KEYS } from '@/domain/config/keys';
import { recommendAgents } from '@/domain/agent-routing';
import { consentText, CONSENT_TEXT_VERSION } from '@/server/services/referral-consent-text';
import type { DiagnosisInput, DiagnosisMasters } from '@/domain/diagnosis/types';
import { SALARY_BANDS as QUESTIONNAIRE_SALARY_BANDS } from '@/domain/diagnosis/input-schema';
import { toExperienceBand } from '@/domain/diagnosis/engine';
import {
  AGENT_COMPANIES,
  CERTIFICATIONS,
  EXPERIENCE_MULTIPLIER,
  INCENTIVE_RULES,
  LOCATIONS,
  OCCUPATIONS,
  OCCUPATION_CERTIFICATIONS,
  OCCUPATION_SKILLS,
  REGIONS,
  REGION_MULTIPLIER,
  SALES_USERS,
  SKILLS,
  TRANSITIONS,
  type CertificationCode,
  type OccupationCode,
  type SkillCode,
} from './seed-data';

/* ------------------------------------------------------- deterministic RNG */

let seedState = 20260824;
function random(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick from empty array');
  return item;
}
function pickSome<T>(items: readonly T[], min: number, max: number): T[] {
  const count = min + Math.floor(random() * (max - min + 1));
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = Math.floor(random() * pool.length);
    out.push(...pool.splice(index, 1));
  }
  return out;
}
function chance(probability: number): boolean {
  return random() < probability;
}
function roundTo(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

const CANDIDATE_FIRST_NAMES = ['大輝', '翔', '健一', '美咲', '陽子', '直樹', '拓也', '彩', '諒', '真也'];
const CANDIDATE_LAST_NAMES = ['山本', '中村', '小林', '加藤', '吉田', '松本', '井上', '木村', '林', '清水'];

async function main() {
  const db = getDb();
  const password = process.env.SEED_PASSWORD ?? 'password123';
  const passwordHash = await hashPassword(password);

  const log = (message: string) => console.log(`  ${message}`);

  log('既存データを削除しています...');
  await db.execute(sql`
    truncate table
      incentive_ledger, incentive_rules, revenue_events, agent_fee_rules,
      referrals, consents, agent_recommendations, interviews,
      diagnosis_occupation_matches, diagnoses, candidate_events, scan_events,
      candidate_attributions, candidates, qr_codes, shifts, locations,
      salary_market_benchmarks, career_transition_rules, occupation_skills,
      occupation_certifications, certifications, skills, occupations, regions, app_settings, audit_logs,
      sessions, users, agent_companies
    restart identity cascade
  `);

  /* --------------------------------------------------------------- masters */

  const regionRows = await db.insert(schema.regions).values(REGIONS.map((r) => ({ ...r }))).returning();
  const regionByCode = new Map(regionRows.map((r) => [r.code, r]));

  const occupationRows = await db
    .insert(schema.occupations)
    .values(OCCUPATIONS.map((o) => ({ code: o.code, name: o.name, category: o.category })))
    .returning();
  const occupationByCode = new Map(occupationRows.map((o) => [o.code, o]));

  const skillRows = await db.insert(schema.skills).values(SKILLS.map((s) => ({ ...s }))).returning();
  const skillByCode = new Map(skillRows.map((s) => [s.code, s]));

  const certRows = await db
    .insert(schema.certifications)
    .values(CERTIFICATIONS.map((c) => ({ ...c })))
    .returning();
  const certByCode = new Map(certRows.map((c) => [c.code, c]));

  const occupationSkillValues = Object.entries(OCCUPATION_SKILLS).flatMap(([code, links]) =>
    links.map(([skillCode, weight]) => ({
      occupationId: occupationByCode.get(code)?.id ?? '',
      skillId: skillByCode.get(skillCode)?.id ?? '',
      importanceWeight: weight.toFixed(3),
    })),
  );
  await db.insert(schema.occupationSkills).values(occupationSkillValues);

  const occupationCertificationValues = Object.entries(OCCUPATION_CERTIFICATIONS).flatMap(([code, links]) =>
    links.map(([certCode, weight]) => ({
      occupationId: occupationByCode.get(code)?.id ?? '',
      certificationId: certByCode.get(certCode)?.id ?? '',
      importanceWeight: weight.toFixed(3),
    })),
  );
  await db.insert(schema.occupationCertifications).values(occupationCertificationValues);

  const ids = (codes: readonly string[] | undefined, map: Map<string, { id: string }>) =>
    (codes ?? []).map((code) => map.get(code)?.id ?? '').filter(Boolean);

  await db.insert(schema.careerTransitionRules).values(
    TRANSITIONS.map((t) => ({
      sourceOccupationId: occupationByCode.get(t.source)?.id ?? '',
      targetOccupationId: occupationByCode.get(t.target)?.id ?? '',
      baseTransitionScore: t.base,
      requiredSkillIds: ids(t.requiredSkills, skillByCode),
      preferredSkillIds: ids(t.preferredSkills, skillByCode),
      requiredCertificationIds: ids(t.requiredCertifications, certByCode),
      preferredCertificationIds: ids(t.preferredCertifications, certByCode),
      minimumExperienceYears: t.minimumExperienceYears ?? 0,
      requiresRelocation: t.requiresRelocation ?? false,
      requiresBusinessTrip: t.requiresBusinessTrip ?? false,
      requiresNightShift: t.requiresNightShift ?? false,
      notes: t.notes ?? null,
    })),
  );
  log(`職種 ${occupationRows.length} 件 / キャリア遷移ルール ${TRANSITIONS.length} 件`);

  const benchmarkValues = OCCUPATIONS.flatMap((occupation) =>
    REGIONS.flatMap((region) =>
      Object.entries(EXPERIENCE_MULTIPLIER).map(([band, multiplier]) => {
        const median = roundTo(occupation.base * multiplier * (REGION_MULTIPLIER[region.code] ?? 1), 10_000);
        return {
          occupationId: occupationByCode.get(occupation.code)?.id ?? '',
          regionId: regionByCode.get(region.code)?.id ?? '',
          experienceBand: band as (typeof schema.experienceBandEnum.enumValues)[number],
          educationLevel: null,
          salaryLow: roundTo(median * 0.89, 10_000),
          salaryMedian: median,
          salaryHigh: roundTo(median * 1.14, 10_000),
          source: 'manual',
          sourceDate: '2026-04-01',
          confidenceLevel: region.isNationalFallback ? ('low' as const) : ('medium' as const),
          sampleSize: region.isNationalFallback ? 1200 : 180,
        };
      }),
    ),
  );
  await db.insert(schema.salaryMarketBenchmarks).values(benchmarkValues);
  log(`市場年収ベンチマーク ${benchmarkValues.length} 件`);

  /* ----------------------------------------------------------- identities */

  const agentCompanyRows = await db
    .insert(schema.agentCompanies)
    .values(
      AGENT_COMPANIES.map((a) => ({
        name: a.name,
        contactEmail: a.contactEmail,
        specialtyOccupationIds: a.specialties.map((code) => occupationByCode.get(code)?.id ?? ''),
        coverageRegionIds: a.regions.map((code) => regionByCode.get(code)?.id ?? ''),
        minSalaryFocus: a.minSalaryFocus,
        maxSalaryFocus: a.maxSalaryFocus,
      })),
    )
    .returning();

  const userRows = await db
    .insert(schema.users)
    .values([
      { email: 'admin@example.com', passwordHash, displayName: '管理者 一郎', role: 'admin' as const, agentCompanyId: null },
      ...SALES_USERS.map((s) => ({
        email: s.email,
        passwordHash,
        displayName: s.name,
        role: 'sales' as const,
        agentCompanyId: null,
      })),
      ...AGENT_COMPANIES.map((a, index) => ({
        email: a.userEmail,
        passwordHash,
        displayName: a.userName,
        role: 'agent' as const,
        agentCompanyId: agentCompanyRows[index]?.id ?? null,
      })),
    ])
    .returning();

  const salesUsers = userRows.filter((u) => u.role === 'sales');
  const salesStrength = new Map(
    salesUsers.map((u) => [u.id, SALES_USERS.find((s) => s.email === u.email)?.strength ?? 1]),
  );
  log(`ユーザー ${userRows.length} 名 / エージェント ${agentCompanyRows.length} 社`);

  await db.insert(schema.agentFeeRules).values(
    agentCompanyRows.flatMap((agent) => [
      { agentCompanyId: agent.id, eventType: 'agent_interview_completed' as const, amount: 30_000 },
      { agentCompanyId: agent.id, eventType: 'offer' as const, amount: 80_000 },
      {
        agentCompanyId: agent.id,
        eventType: 'joined' as const,
        amount: 0,
        percentOfOfferSalary: '15.00',
      },
    ]),
  );

  const incentiveRuleRows = await db
    .insert(schema.incentiveRules)
    .values(
      INCENTIVE_RULES.map((rule) => ({
        eventType: rule.eventType,
        amount: rule.amount,
        description: rule.description,
        conditions: rule.conditions ?? {},
        validFrom: new Date('2026-01-01T00:00:00Z'),
      })),
    )
    .returning();

  await db.insert(schema.appSettings).values([
    { key: SETTING_KEYS.diagnosis, value: DEFAULT_DIAGNOSIS_CONFIG, description: '年収診断エンジンの重み・閾値' },
    { key: SETTING_KEYS.analytics, value: DEFAULT_ANALYTICS_CONFIG, description: 'Area Score・原価前提' },
    { key: SETTING_KEYS.agentRouting, value: DEFAULT_AGENT_ROUTING_CONFIG, description: 'エージェント推薦スコアの重み' },
    { key: SETTING_KEYS.incentive, value: DEFAULT_INCENTIVE_CONFIG, description: 'インセンティブ運用設定' },
  ]);

  const locationRows = await db
    .insert(schema.locations)
    .values(
      LOCATIONS.map((l) => ({
        prefecture: l.prefecture,
        city: l.city,
        district: l.district,
        venueName: l.venueName,
        venueType: l.venueType,
        stationName: l.stationName,
        regionId: regionByCode.get(l.regionCode)?.id ?? null,
      })),
    )
    .returning();
  const locationStrength = new Map(
    locationRows.map((l) => [l.id, LOCATIONS.find((s) => s.venueName === l.venueName)?.strength ?? 1]),
  );

  /* ---------------------------------------------------------------- shifts */

  const now = new Date();
  const WEATHERS = ['sunny', 'sunny', 'cloudy', 'cloudy', 'rainy'] as const;
  const SLOTS = [
    { startHour: 10, hours: 4 },
    { startHour: 11, hours: 5 },
    { startHour: 13, hours: 4 },
    { startHour: 16, hours: 3 },
  ];

  interface SeedShift {
    id: string;
    salesUserId: string;
    locationId: string;
    startTime: Date;
    endTime: Date;
    qrCodeId: string;
    approachCount: number;
    stoppedCount: number;
    scanTarget: number;
    strength: number;
  }

  const seedShifts: SeedShift[] = [];
  for (let dayOffset = 112; dayOffset >= 0; dayOffset -= 2) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const shiftsToday = isWeekend ? 2 : 1;

    for (let i = 0; i < shiftsToday; i += 1) {
      const salesUser = pick(salesUsers);
      const location = pick(locationRows);
      const slot = pick(SLOTS);
      const weather = pick(WEATHERS);

      const startTime = new Date(day);
      startTime.setHours(slot.startHour, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + slot.hours * 3_600_000);

      const strength =
        (locationStrength.get(location.id) ?? 1) *
        (salesStrength.get(salesUser.id) ?? 1) *
        (isWeekend ? 1.2 : 0.9) *
        (weather === 'rainy' ? 0.7 : 1) *
        (slot.startHour >= 11 && slot.startHour <= 13 ? 1.15 : 0.95);

      const approachCount = Math.round(slot.hours * (16 + random() * 8) * Math.min(1.3, strength));
      const stoppedCount = Math.round(approachCount * (0.24 + random() * 0.16) * Math.min(1.25, strength));
      const scanTarget = Math.round(stoppedCount * (0.38 + random() * 0.24) * Math.min(1.2, strength));

      const shiftInserted = await db
        .insert(schema.shifts)
        .values({
          salesUserId: salesUser.id,
          locationId: location.id,
          startTime,
          plannedEndTime: endTime,
          endTime,
          weather,
          venueType: location.venueType,
          status: 'closed',
          approachCount,
          stoppedCount,
          createdAt: startTime,
        })
        .returning();
      const shift = shiftInserted[0];
      if (!shift) continue;

      const qrInserted = await db
        .insert(schema.qrCodes)
        .values({
          token: generateToken(12),
          shiftId: shift.id,
          salesUserId: salesUser.id,
          locationId: location.id,
          active: false,
          createdAt: startTime,
        })
        .returning();
      const qr = qrInserted[0];
      if (!qr) continue;

      seedShifts.push({
        id: shift.id,
        salesUserId: salesUser.id,
        locationId: location.id,
        startTime,
        endTime,
        qrCodeId: qr.id,
        approachCount,
        stoppedCount,
        scanTarget,
        strength,
      });
    }
  }
  log(`シフト ${seedShifts.length} 件（QRコード同数）`);

  /* ------------------------------------------------------- engine masters */

  const masters: DiagnosisMasters = {
    occupations: occupationRows.map((o) => ({ id: o.id, name: o.name, category: o.category })),
    skills: skillRows.map((s) => ({ id: s.id, name: s.name, category: s.category })),
    certifications: certRows.map((c) => ({ id: c.id, name: c.name, category: c.category })),
    regions: regionRows.map((r) => ({
      id: r.id,
      name: r.name,
      prefecture: r.prefecture,
      isNationalFallback: r.isNationalFallback,
    })),
    occupationSkills: occupationSkillValues.map((os) => ({
      occupationId: os.occupationId,
      skillId: os.skillId,
      importanceWeight: Number(os.importanceWeight),
    })),
    occupationCertifications: occupationCertificationValues.map((oc) => ({
      occupationId: oc.occupationId,
      certificationId: oc.certificationId,
      importanceWeight: Number(oc.importanceWeight),
    })),
    transitionRules: TRANSITIONS.map((t, index) => ({
      id: `rule-${index}`,
      sourceOccupationId: occupationByCode.get(t.source)?.id ?? '',
      targetOccupationId: occupationByCode.get(t.target)?.id ?? '',
      baseTransitionScore: t.base,
      requiredSkillIds: ids(t.requiredSkills, skillByCode),
      preferredSkillIds: ids(t.preferredSkills, skillByCode),
      requiredCertificationIds: ids(t.requiredCertifications, certByCode),
      preferredCertificationIds: ids(t.preferredCertifications, certByCode),
      minimumExperienceYears: t.minimumExperienceYears ?? 0,
      requiresRelocation: t.requiresRelocation ?? false,
      requiresBusinessTrip: t.requiresBusinessTrip ?? false,
      requiresNightShift: t.requiresNightShift ?? false,
      notes: t.notes ?? null,
    })),
    benchmarks: benchmarkValues.map((b) => ({
      occupationId: b.occupationId,
      regionId: b.regionId,
      experienceBand: b.experienceBand,
      educationLevel: null,
      salaryLow: b.salaryLow,
      salaryMedian: b.salaryMedian,
      salaryHigh: b.salaryHigh,
      confidenceLevel: b.confidenceLevel,
      source: b.source,
    })),
  };

  const incentiveRules: IncentiveRule[] = incentiveRuleRows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    amount: r.amount,
    validFrom: r.validFrom,
    validTo: r.validTo,
    active: r.active,
    conditions: r.conditions,
  }));

  const ledgerKeys: { candidateId: string; eventType: MonetizableEvent }[] = [];

  /* ------------------------------------------------------------ candidates */

  const SOURCE_OCCUPATIONS: OccupationCode[] = [
    'auto_mechanic',
    'auto_mechanic',
    'equipment_maintenance',
    'electrical_construction',
    'building_maintenance',
    'sales',
    'production_technician',
  ];
  const PREFECTURES = ['大阪府', '兵庫県', '京都府'];
  /** Picks the questionnaire band whose midpoint is closest to a JPY figure. */
  const bandForSalary = (salary: number) =>
    [...QUESTIONNAIRE_SALARY_BANDS].sort(
      (a, b) => Math.abs(a.midpoint - salary) - Math.abs(b.midpoint - salary),
    )[0] ?? QUESTIONNAIRE_SALARY_BANDS[3];
  const EXPERIENCES = [1, 4, 7, 12, 18];
  const AGE_BANDS = ['20代前半', '20代後半', '30代前半', '30代後半', '40代'];
  const TIMINGS = ['1ヶ月以内', '1〜3ヶ月', '3〜6ヶ月', '半年以上先', '良い求人があれば'];
  const EDUCATIONS = ['high_school', 'vocational', 'associate', 'bachelor'] as const;

  let candidateCount = 0;
  let referralCount = 0;
  let joinedCount = 0;

  for (const shift of seedShifts) {
    const scans = Math.max(0, Math.round(shift.scanTarget));
    for (let i = 0; i < scans; i += 1) {
      const scanAt = new Date(
        shift.startTime.getTime() + random() * (shift.endTime.getTime() - shift.startTime.getTime()),
      );

      const candidateInserted = await db
        .insert(schema.candidates)
        .values({ publicToken: generateToken(18), status: 'anonymous', createdAt: scanAt, updatedAt: scanAt })
        .returning();
      const candidate = candidateInserted[0];
      if (!candidate) continue;
      candidateCount += 1;

      await db.insert(schema.candidateAttributions).values({
        candidateId: candidate.id,
        qrCodeId: shift.qrCodeId,
        salesUserId: shift.salesUserId,
        shiftId: shift.id,
        locationId: shift.locationId,
        source: 'qr',
        attributedAt: scanAt,
      });
      await db.insert(schema.scanEvents).values({
        qrCodeId: shift.qrCodeId,
        candidateId: candidate.id,
        createdAt: scanAt,
      });

      const events: {
        eventType: (typeof schema.candidateEventTypeEnum.enumValues)[number];
        at: Date;
        agentCompanyId?: string;
        metadata?: Record<string, unknown>;
      }[] = [{ eventType: 'qr_scanned', at: scanAt }];

      const startsDiagnosis = chance(0.88);
      if (!startsDiagnosis) {
        await insertEvents(candidate.id, shift, events);
        continue;
      }
      events.push({ eventType: 'diagnosis_started', at: scanAt });

      if (!chance(0.72)) {
        await insertEvents(candidate.id, shift, events);
        continue;
      }

      /* ---- run the real engine so seeded results match production output ---- */
      const occupationCode = pick(SOURCE_OCCUPATIONS);
      const occupation = occupationByCode.get(occupationCode);
      if (!occupation) continue;
      const currentPrefecture = pick(PREFECTURES);
      const experienceYears = pick(EXPERIENCES);
      // Anchor the seeded salary to the market so the rank distribution is realistic:
      // most people sit slightly below their occupation's regional median.
      const regionCode =
        currentPrefecture === '大阪府' ? 'osaka' : currentPrefecture === '兵庫県' ? 'hyogo' : 'kyoto';
      const marketMedian =
        benchmarkValues.find(
          (b) =>
            b.occupationId === occupation.id &&
            b.regionId === regionByCode.get(regionCode)?.id &&
            b.experienceBand === toExperienceBand(experienceYears),
        )?.salaryMedian ?? 4_000_000;
      const band = bandForSalary(marketMedian * (0.88 + random() * 0.2));
      const relatedSkills = OCCUPATION_SKILLS[occupationCode].map(([code]) => code);
      const chosenSkills = pickSome<SkillCode>(relatedSkills, 2, relatedSkills.length);
      const relevantCerts = OCCUPATION_CERTIFICATIONS[occupationCode].map(([code]) => code);
      const chosenCerts = [
        ...pickSome<CertificationCode>(relevantCerts, 0, Math.min(3, relevantCerts.length)),
        ...(chance(0.25) ? pickSome<CertificationCode>(CERTIFICATIONS.map((c) => c.code), 1, 1) : []),
      ].filter((code, index, all) => all.indexOf(code) === index);
      const ageBand = pick(AGE_BANDS);
      const timing = pick(TIMINGS);

      const input: DiagnosisInput = {
        currentSalary: band.midpoint,
        currentOccupationId: occupation.id,
        currentIndustry: '機械・電機',
        experienceYears,
        skillIds: chosenSkills.map((code) => skillByCode.get(code)?.id ?? ''),
        certificationIds: chosenCerts.map((code) => certByCode.get(code)?.id ?? ''),
        hasManagementExperience: chance(0.3),
        employmentType: 'full_time',
        currentPrefecture,
        desiredPrefectures: chance(0.6) ? [currentPrefecture] : [currentPrefecture, pick(PREFECTURES)],
        relocationOk: chance(0.35),
        businessTripOk: chance(0.6),
        nightShiftOk: chance(0.4),
        educationLevel: pick(EDUCATIONS),
        desiredConditions: ['年収アップ'],
        ageBand,
        jobChangeTiming: timing,
      };

      const result = runDiagnosis(input, masters, DEFAULT_DIAGNOSIS_CONFIG);
      const completedAt = new Date(scanAt.getTime() + 4 * 60_000);

      const answers = {
        salaryBand: band.value,
        occupationId: occupation.id,
        industry: input.currentIndustry,
        experienceYears,
        certificationIds: input.certificationIds,
        skillIds: input.skillIds,
        hasManagementExperience: input.hasManagementExperience,
        employmentType: input.employmentType,
        currentPrefecture,
        desiredPrefectures: input.desiredPrefectures,
        relocationOk: input.relocationOk,
        businessTripOk: input.businessTripOk,
        nightShiftOk: input.nightShiftOk,
        educationLevel: input.educationLevel,
        desiredConditions: input.desiredConditions,
        ageBand,
        jobChangeTiming: timing,
      };

      const diagnosisInserted = await db
        .insert(schema.diagnoses)
        .values({
          candidateId: candidate.id,
          input: answers,
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
          configSnapshot: DEFAULT_DIAGNOSIS_CONFIG as unknown as Record<string, unknown>,
          engineVersion: result.engineVersion,
          startedAt: scanAt,
          completedAt,
        })
        .returning();
      const diagnosis = diagnosisInserted[0];
      if (!diagnosis) continue;

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

      events.push({
        eventType: 'diagnosis_completed',
        at: completedAt,
        metadata: { valueRank: result.valueRank },
      });

      let status: (typeof schema.candidateStatusEnum.enumValues)[number] = 'diagnosed';
      let leadRegisteredAt: Date | null = null;
      let fullName: string | null = null;
      let email: string | null = null;
      let phone: string | null = null;

      if (result.qualified) {
        events.push({ eventType: 'candidate_qualified', at: completedAt });
      }

      const registers = chance(result.qualified ? 0.34 : 0.12);
      if (registers) {
        leadRegisteredAt = new Date(completedAt.getTime() + 6 * 60_000);
        fullName = `${pick(CANDIDATE_LAST_NAMES)} ${pick(CANDIDATE_FIRST_NAMES)}`;
        email = `candidate${candidateCount}@example.com`;
        phone = `090-${String(1000 + Math.floor(random() * 8999))}-${String(1000 + Math.floor(random() * 8999))}`;
        status = 'lead';
        events.push({ eventType: 'lead_registered', at: leadRegisteredAt });
      }

      let interviewCompletedAt: Date | null = null;
      if (leadRegisteredAt && chance(0.45)) {
        const scheduledAt = new Date(leadRegisteredAt.getTime() + (2 + random() * 5) * 86_400_000);
        await db.insert(schema.interviews).values({
          candidateId: candidate.id,
          scheduledAt,
          status: 'booked',
          mode: chance(0.7) ? 'online' : 'phone',
          bookedAt: leadRegisteredAt,
        });
        status = 'interview_booked';
        events.push({ eventType: 'interview_booked', at: leadRegisteredAt });

        if (scheduledAt < now && chance(0.6)) {
          interviewCompletedAt = scheduledAt;
          await db
            .update(schema.interviews)
            .set({ status: 'completed', completedAt: scheduledAt })
            .where(sql`${schema.interviews.candidateId} = ${candidate.id}`);
          status = 'interview_completed';
          events.push({ eventType: 'interview_completed', at: scheduledAt });
        }
      }

      /* ------------------------------- agent routing, consent and outcome -- */
      if (interviewCompletedAt && result.qualified && chance(0.7)) {
        const recommendations = recommendAgents(
          {
            topOccupationIds: result.options.slice(0, 3).map((o) => o.occupationId),
            regionId: result.regionId,
            desiredPrefectures: input.desiredPrefectures,
            estimatedSalaryHigh: result.estimatedSalaryHigh,
            experienceYears,
            hasManagementExperience: input.hasManagementExperience,
          },
          agentCompanyRows.map((a) => ({
            id: a.id,
            name: a.name,
            specialtyOccupationIds: a.specialtyOccupationIds,
            coverageRegionIds: a.coverageRegionIds,
            minSalaryFocus: a.minSalaryFocus,
            maxSalaryFocus: a.maxSalaryFocus,
            active: a.active,
          })),
          [],
          DEFAULT_AGENT_ROUTING_CONFIG,
        );
        if (recommendations.length > 0) {
          await db.insert(schema.agentRecommendations).values(
            recommendations.map((r) => ({
              candidateId: candidate.id,
              agentCompanyId: r.agentCompanyId,
              score: r.score,
              breakdown: r.breakdown,
              rankPosition: r.rankPosition,
              createdAt: interviewCompletedAt,
            })),
          );
          events.push({ eventType: 'agent_recommended', at: interviewCompletedAt });

          const chosen = recommendations[Math.min(recommendations.length - 1, Math.floor(random() * 2))];
          const agent = agentCompanyRows.find((a) => a.id === chosen?.agentCompanyId);
          if (agent && chosen) {
            const consentAt = new Date(interviewCompletedAt.getTime() + 3_600_000);
            const consentInserted = await db
              .insert(schema.consents)
              .values({
                candidateId: candidate.id,
                agentCompanyId: agent.id,
                consentText: consentText(agent.name),
                consentVersion: CONSENT_TEXT_VERSION,
                grantedAt: consentAt,
              })
              .returning();
            const consent = consentInserted[0];
            if (consent) {
              events.push({ eventType: 'consent_given', at: consentAt, agentCompanyId: agent.id });

              const agentStrength =
                AGENT_COMPANIES.find((a) => a.name === agent.name)?.strength ?? 1;
              const referralPatch: Record<string, unknown> = {};
              let referralStatus: (typeof schema.referralStatusEnum.enumValues)[number] = 'referred';
              const referredAt = consentAt;
              events.push({ eventType: 'agent_referred', at: referredAt, agentCompanyId: agent.id });
              referralCount += 1;

              const revenueRows: {
                eventType: (typeof schema.monetizableEventEnum.enumValues)[number];
                amount: number;
                status: 'estimated' | 'confirmed';
                at: Date;
              }[] = [];

              if (chance(0.75 * agentStrength)) {
                const acceptedAt = new Date(referredAt.getTime() + 86_400_000);
                referralPatch.acceptedAt = acceptedAt;
                referralStatus = 'accepted';
                events.push({ eventType: 'agent_accepted', at: acceptedAt, agentCompanyId: agent.id });

                if (chance(0.55 * agentStrength)) {
                  const agentInterviewAt = new Date(acceptedAt.getTime() + 3 * 86_400_000);
                  referralPatch.contactedAt = acceptedAt;
                  referralPatch.interviewScheduledAt = acceptedAt;
                  referralPatch.interviewCompletedAt = agentInterviewAt;
                  referralStatus = 'interview_completed';
                  events.push({
                    eventType: 'agent_interview_completed',
                    at: agentInterviewAt,
                    agentCompanyId: agent.id,
                  });
                  revenueRows.push({
                    eventType: 'agent_interview_completed',
                    amount: 30_000,
                    status: 'estimated',
                    at: agentInterviewAt,
                  });

                  if (chance(0.6)) {
                    const appliedAt = new Date(agentInterviewAt.getTime() + 4 * 86_400_000);
                    referralPatch.appliedAt = appliedAt;
                    referralStatus = 'application';
                    events.push({ eventType: 'applied', at: appliedAt, agentCompanyId: agent.id });

                    if (chance(0.45 * agentStrength) && appliedAt < now) {
                      const offerAt = new Date(appliedAt.getTime() + 8 * 86_400_000);
                      const topOption = result.upsideOptions[0] ?? result.options[0];
                      const offerSalary = roundTo(
                        Math.max(result.currentSalary, topOption?.expectedSalary ?? result.currentSalary) *
                          (0.97 + random() * 0.1),
                        10_000,
                      );
                      referralPatch.offerAt = offerAt;
                      referralPatch.offerSalary = offerSalary;
                      referralPatch.offerDate = offerAt.toISOString().slice(0, 10);
                      referralPatch.offerCompanyName = `株式会社${pick(['西日本テクノ', '関西メンテナンス', 'ミライ機工', '大阪サービス工業'])}`;
                      referralPatch.offerJobTitle = topOption?.occupationName ?? '技術職';
                      referralPatch.offerOccupationId = topOption?.occupationId ?? null;
                      referralStatus = 'offer';
                      events.push({ eventType: 'offer_received', at: offerAt, agentCompanyId: agent.id });
                      revenueRows.push({ eventType: 'offer', amount: 80_000, status: 'estimated', at: offerAt });

                      if (chance(0.65) && offerAt < now) {
                        const joinedAt = new Date(offerAt.getTime() + 14 * 86_400_000);
                        referralPatch.joinedAt = joinedAt;
                        referralPatch.joinedDate = joinedAt.toISOString().slice(0, 10);
                        referralStatus = 'joined';
                        status = 'joined';
                        joinedCount += 1;
                        events.push({ eventType: 'joined', at: joinedAt, agentCompanyId: agent.id });
                        revenueRows.push({
                          eventType: 'joined',
                          amount: Math.round(offerSalary * 0.15),
                          status: 'confirmed',
                          at: joinedAt,
                        });
                      }
                    }
                  }
                }
              } else {
                referralPatch.declinedAt = new Date(referredAt.getTime() + 86_400_000);
                referralStatus = 'declined';
                events.push({
                  eventType: 'agent_declined',
                  at: referralPatch.declinedAt as Date,
                  agentCompanyId: agent.id,
                });
              }

              const referralInserted = await db
                .insert(schema.referrals)
                .values({
                  candidateId: candidate.id,
                  agentCompanyId: agent.id,
                  consentId: consent.id,
                  status: referralStatus,
                  referredAt,
                  ...referralPatch,
                })
                .returning();
              const referral = referralInserted[0];

              if (referral) {
                for (const revenue of revenueRows) {
                  await db.insert(schema.revenueEvents).values({
                    candidateId: candidate.id,
                    agentCompanyId: agent.id,
                    referralId: referral.id,
                    eventType: revenue.eventType,
                    amount: revenue.amount,
                    status: revenue.status,
                    occurredAt: revenue.at,
                    confirmedAt: revenue.status === 'confirmed' ? revenue.at : null,
                  });
                }
              }

              if (status !== 'joined') status = 'referred';
            }
          }
        }
      }

      await db
        .update(schema.candidates)
        .set({
          status,
          fullName,
          email,
          phone,
          prefecture: currentPrefecture,
          desiredPrefectures: input.desiredPrefectures,
          ageBand,
          jobChangeTiming: timing,
          qualified: result.qualified,
          qualifiedAt: result.qualified ? completedAt : null,
          leadRegisteredAt,
          birthYear: fullName ? 1985 + Math.floor(random() * 15) : null,
          updatedAt: completedAt,
        })
        .where(sql`${schema.candidates.id} = ${candidate.id}`);

      await insertEvents(candidate.id, shift, events);

      /* -------------------------------------------- incentives from events -- */
      for (const event of events) {
        const monetizable = schema.monetizableEventEnum.enumValues.includes(
          event.eventType as MonetizableEvent,
        )
          ? (event.eventType as MonetizableEvent)
          : null;
        if (!monetizable) continue;

        const decision = evaluateIncentive(
          {
            candidateId: candidate.id,
            salesUserId: shift.salesUserId,
            shiftId: shift.id,
            eventType: monetizable,
            occurredAt: event.at,
            matchScore: result.bestMatchScore,
            marketValueScore: result.marketValueScore,
            qualified: result.qualified,
          },
          incentiveRules,
          ledgerKeys,
        );
        if (!decision.awarded) continue;
        ledgerKeys.push({ candidateId: candidate.id, eventType: monetizable });

        const approved = event.at.getTime() < now.getTime() - 7 * 86_400_000;
        await db.insert(schema.incentiveLedger).values({
          salesUserId: decision.salesUserId,
          candidateId: decision.candidateId,
          shiftId: decision.shiftId,
          eventType: decision.eventType,
          amount: decision.amount,
          ruleId: decision.ruleId,
          status: approved ? 'approved' : 'pending',
          occurredAt: decision.occurredAt,
          approvedAt: approved ? new Date(event.at.getTime() + 86_400_000) : null,
        });
      }
    }
  }

  async function insertEvents(
    candidateId: string,
    shift: SeedShift,
    events: {
      eventType: (typeof schema.candidateEventTypeEnum.enumValues)[number];
      at: Date;
      agentCompanyId?: string;
      metadata?: Record<string, unknown>;
    }[],
  ) {
    if (events.length === 0) return;
    await db.insert(schema.candidateEvents).values(
      events.map((event) => ({
        candidateId,
        eventType: event.eventType,
        userId: shift.salesUserId,
        shiftId: shift.id,
        locationId: shift.locationId,
        agentCompanyId: event.agentCompanyId ?? null,
        metadata: event.metadata ?? {},
        createdAt: event.at,
      })),
    );
  }

  log(`候補者 ${candidateCount} 名 / 送客 ${referralCount} 件 / 入社 ${joinedCount} 件`);
  console.log('\nシードデータの投入が完了しました。');
  console.log(`ログイン: admin@example.com / sales1@example.com / agent1@example.com （パスワード: ${password}）`);

  await getPool().end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
