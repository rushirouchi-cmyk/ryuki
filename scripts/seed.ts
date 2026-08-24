import "dotenv/config";

/*
 * Shift start times are business wall-clock times, and the analytics layer
 * buckets them in Asia/Tokyo. Pin the process timezone before any Date is
 * constructed so a seed run on a UTC machine produces the same dataset.
 */
process.env.TZ = process.env.TZ ?? "Asia/Tokyo";

import { sql } from "drizzle-orm";
import { getDb, resolveDriver, type Database } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";
import {
  acquisitionCosts,
  agentCompanies,
  agentFeeRules,
  agentRegions,
  agentSalaryBands,
  agentSpecialties,
  appSettings,
  careerTransitionRules,
  certifications,
  incentiveRules,
  locations,
  occupationCertifications,
  occupations,
  occupationSkills,
  qrCodes,
  regions,
  salaryMarketBenchmarks,
  shifts,
  skills,
  users,
} from "../src/lib/db/schema";
import { DEFAULT_SETTINGS } from "../src/lib/config/settings";
import { hashPassword } from "../src/lib/auth/password";
import { generateToken } from "../src/lib/utils/token";
import {
  completeDiagnosis,
  completeInterview,
  bookInterview,
  handleQrScan,
  registerLead,
  startDiagnosis,
} from "../src/lib/domain/candidates/service";
import {
  buildRecommendations,
  referCandidate,
  updateReferralStatus,
} from "../src/lib/domain/agents/service";
import type { DiagnosisAnswers } from "../src/lib/domain/diagnosis/questionnaire";
import { EXPERIENCE_BANDS } from "../src/lib/domain/diagnosis/types";
import {
  AGENT_COMPANIES,
  CERTIFICATIONS,
  INCENTIVE_RULES,
  LOCATIONS,
  OCCUPATIONS,
  OCCUPATION_CERTIFICATIONS,
  OCCUPATION_SKILLS,
  REGIONS,
  SALES_USERS,
  SKILLS,
  TRANSITIONS,
} from "./seed/master";
import { createRandom, type Random } from "./seed/random";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";
const WEEKS_OF_HISTORY = 14;
const SHIFTS_PER_WEEK = 7;

const BAND_MULTIPLIER: Record<string, number> = {
  "0-2": 0.82,
  "3-5": 0.94,
  "6-9": 1.06,
  "10-14": 1.16,
  "15+": 1.24,
};

const REGION_MULTIPLIER: Record<string, number> = {
  osaka_city: 1.06,
  osaka_north: 1.0,
  hyogo_south: 1.0,
  kyoto_city: 0.98,
  nara: 0.94,
};

/* Venue / timing quality, the differences the area analytics should surface. */
const VENUE_QUALITY: Record<string, number> = {
  shopping_mall: 1.25,
  shopping_street: 1.0,
  station: 0.7,
  home_center: 1.05,
  residential_area: 0.8,
  supermarket: 0.95,
  park: 0.85,
  event: 1.1,
  other: 0.9,
};

const TIME_BAND_QUALITY: Record<string, number> = {
  "07-11": 0.72,
  "11-15": 1.25,
  "15-19": 1.05,
  "19-23": 0.6,
};

const WEATHER_QUALITY: Record<string, number> = {
  sunny: 1.1,
  cloudy: 1.0,
  hot: 0.8,
  cold: 0.85,
  rainy: 0.55,
  snowy: 0.4,
};

const FAMILY_NAMES = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "松本", "井上", "木村", "林", "清水", "山口", "森", "池田",
];
const GIVEN_NAMES = [
  "翔太", "健一", "拓也", "大輔", "涼介", "直樹", "遥", "美咲", "彩", "陽子",
  "真一", "和也", "祐介", "亮", "剛", "千夏", "愛", "優子", "隼人", "航平",
];

function roundTo(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function timeBandOf(hour: number): string {
  if (hour >= 7 && hour < 11) return "07-11";
  if (hour >= 11 && hour < 15) return "11-15";
  if (hour >= 15 && hour < 19) return "15-19";
  if (hour >= 19 && hour < 23) return "19-23";
  return "other";
}

async function truncateAll(db: Database): Promise<void> {
  const tables = [
    "audit_logs", "acquisition_costs", "incentive_ledger", "incentive_rules",
    "revenue_events", "referrals", "consents", "agent_recommendations",
    "interview_bookings", "diagnosis_occupation_matches", "diagnosis_certifications",
    "diagnosis_skills", "diagnoses", "candidate_events", "scan_events",
    "candidate_contacts", "candidates", "qr_codes", "shift_counter_events", "shifts",
    "locations", "salary_market_benchmarks", "career_transition_rules",
    "occupation_certifications", "occupation_skills", "certifications", "skills",
    "occupations", "agent_fee_rules", "agent_salary_bands", "agent_regions",
    "agent_specialties", "auth_sessions", "users", "agent_companies", "regions",
    "app_settings",
  ];
  await db.execute(sql.raw(`truncate table ${tables.join(", ")} restart identity cascade`));
}

async function seedMasterData(db: Database) {
  const regionRows = await db
    .insert(regions)
    .values(REGIONS.map((region) => ({ ...region })))
    .returning();
  const regionByCode = new Map(regionRows.map((row) => [row.code, row]));

  const occupationRows = await db
    .insert(occupations)
    .values(
      OCCUPATIONS.map((occupation) => ({
        code: occupation.code,
        name: occupation.name,
        category: occupation.category,
        description: occupation.description,
        requiresTravel: occupation.requiresTravel,
        requiresNightShift: occupation.requiresNightShift,
        requiresRelocation: occupation.requiresRelocation,
        minEducationLevel: occupation.minEducationLevel,
        managementRelevant: occupation.managementRelevant,
      })),
    )
    .returning();
  const occupationByCode = new Map(occupationRows.map((row) => [row.code, row]));

  const skillRows = await db
    .insert(skills)
    .values(SKILLS.map((skill) => ({ ...skill })))
    .returning();
  const skillByCode = new Map(skillRows.map((row) => [row.code, row]));

  const certificationRows = await db
    .insert(certifications)
    .values(CERTIFICATIONS.map((certification) => ({ ...certification })))
    .returning();
  const certificationByCode = new Map(certificationRows.map((row) => [row.code, row]));

  await db.insert(occupationSkills).values(
    Object.entries(OCCUPATION_SKILLS).flatMap(([occupationCode, links]) =>
      links.map(([skillCode, weight]) => ({
        occupationId: occupationByCode.get(occupationCode)!.id,
        skillId: skillByCode.get(skillCode)!.id,
        importanceWeight: weight.toFixed(3),
      })),
    ),
  );

  await db.insert(occupationCertifications).values(
    Object.entries(OCCUPATION_CERTIFICATIONS).flatMap(([occupationCode, links]) =>
      links.map(([certificationCode, weight]) => ({
        occupationId: occupationByCode.get(occupationCode)!.id,
        certificationId: certificationByCode.get(certificationCode)!.id,
        importanceWeight: weight.toFixed(3),
      })),
    ),
  );

  await db.insert(careerTransitionRules).values(
    TRANSITIONS.map((transition) => ({
      sourceOccupationId: occupationByCode.get(transition.source)!.id,
      targetOccupationId: occupationByCode.get(transition.target)!.id,
      baseTransitionScore: transition.base,
      requiredSkillIds: (transition.requiredSkills ?? []).map(
        (code) => skillByCode.get(code)!.id,
      ),
      preferredSkillIds: (transition.preferredSkills ?? []).map(
        (code) => skillByCode.get(code)!.id,
      ),
      requiredCertificationIds: (transition.requiredCertifications ?? []).map(
        (code) => certificationByCode.get(code)!.id,
      ),
      preferredCertificationIds: (transition.preferredCertifications ?? []).map(
        (code) => certificationByCode.get(code)!.id,
      ),
      minimumExperienceYears: transition.minimumExperienceYears ?? 0,
      notes: transition.notes ?? null,
    })),
  );

  /* Benchmarks: one row per occupation x region (plus a national fallback) x band. */
  const benchmarkValues = [];
  for (const occupation of OCCUPATIONS) {
    const occupationId = occupationByCode.get(occupation.code)!.id;
    const targets: { regionId: number | null; multiplier: number }[] = [
      { regionId: null, multiplier: 1.0 },
      ...REGIONS.map((region) => ({
        regionId: regionByCode.get(region.code)!.id,
        multiplier: REGION_MULTIPLIER[region.code] ?? 1,
      })),
    ];

    for (const target of targets) {
      for (const band of EXPERIENCE_BANDS) {
        const median = roundTo(
          occupation.baseSalary * (BAND_MULTIPLIER[band] ?? 1) * target.multiplier,
          10_000,
        );
        benchmarkValues.push({
          occupationId,
          regionId: target.regionId,
          experienceBand: band,
          educationLevel: null,
          salaryLow: roundTo(median * 0.85, 10_000),
          salaryMedian: median,
          salaryHigh: roundTo(median * 1.2, 10_000),
          source: target.regionId === null ? "全国参考値(MVPサンプル)" : "関西求人サンプル",
          sourceDate: "2026-04-01",
          confidenceLevel: target.regionId === null ? ("low" as const) : ("medium" as const),
          sampleSize: target.regionId === null ? 400 : 120,
        });
      }
    }
  }
  await db.insert(salaryMarketBenchmarks).values(benchmarkValues);

  const locationRows = await db
    .insert(locations)
    .values(
      LOCATIONS.map((location) => ({
        regionId: regionByCode.get(location.regionCode)!.id,
        prefecture: location.prefecture,
        city: location.city,
        district: location.district,
        venueName: location.venueName,
        venueType: location.venueType,
        stationName: location.stationName,
        latitude: location.latitude,
        longitude: location.longitude,
      })),
    )
    .returning();

  await db.insert(appSettings).values(
    DEFAULT_SETTINGS.map((setting) => ({
      key: setting.key,
      value: setting.value,
      description: setting.description,
    })),
  );

  await db
    .insert(incentiveRules)
    .values(
      INCENTIVE_RULES.map((rule) => ({
        name: rule.name,
        eventType: rule.eventType,
        amountYen: rule.amountYen,
        validFrom: "2026-01-01",
        validTo: null,
        active: true,
        conditions: rule.conditions,
        priority: rule.priority,
      })),
    );

  return {
    regionRows,
    regionByCode,
    occupationRows,
    occupationByCode,
    skillRows,
    skillByCode,
    certificationRows,
    certificationByCode,
    locationRows,
  };
}

async function seedUsers(
  db: Database,
  regionByCode: Map<string, { id: number }>,
  occupationByCode: Map<string, { id: number }>,
) {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.com",
      passwordHash,
      name: "運営 管理者",
      role: "admin",
    })
    .returning();

  const salesRows = await db
    .insert(users)
    .values(
      SALES_USERS.map((user) => ({
        email: user.email,
        passwordHash,
        name: user.name,
        role: "sales" as const,
      })),
    )
    .returning();

  const companyRows = await db
    .insert(agentCompanies)
    .values(
      AGENT_COMPANIES.map((company) => ({
        name: company.name,
        contactEmail: company.contactEmail,
        notes: company.notes,
      })),
    )
    .returning();

  await db.insert(users).values(
    AGENT_COMPANIES.map((company, index) => ({
      email: company.userEmail,
      passwordHash,
      name: company.userName,
      role: "agent" as const,
      agentCompanyId: companyRows[index]!.id,
    })),
  );

  await db.insert(agentSpecialties).values(
    AGENT_COMPANIES.flatMap((company, index) =>
      company.specialties.map(([occupationCode, strength]) => ({
        agentCompanyId: companyRows[index]!.id,
        occupationId: occupationByCode.get(occupationCode)!.id,
        strength,
      })),
    ),
  );

  await db.insert(agentRegions).values(
    AGENT_COMPANIES.flatMap((company, index) =>
      company.regionCodes.map((code) => ({
        agentCompanyId: companyRows[index]!.id,
        regionId: regionByCode.get(code)!.id,
      })),
    ),
  );

  await db.insert(agentSalaryBands).values(
    AGENT_COMPANIES.map((company, index) => ({
      agentCompanyId: companyRows[index]!.id,
      minSalaryYen: company.minSalary,
      maxSalaryYen: company.maxSalary,
    })),
  );

  await db.insert(agentFeeRules).values(
    AGENT_COMPANIES.flatMap((company, index) =>
      company.fees.map((fee) => ({
        agentCompanyId: companyRows[index]!.id,
        eventType: fee.eventType,
        amountYen: fee.amount,
        validFrom: "2026-01-01",
        validTo: null,
      })),
    ),
  );

  return { admin: admin!, salesRows, companyRows };
}

interface ShiftPlan {
  shiftId: number;
  qrToken: string;
  start: Date;
  end: Date;
  quality: number;
  scanCount: number;
}

async function seedShifts(
  db: Database,
  random: Random,
  salesRows: { id: string }[],
  locationRows: { id: number; venueType: string }[],
  today: Date,
): Promise<ShiftPlan[]> {
  const plans: ShiftPlan[] = [];

  for (let week = WEEKS_OF_HISTORY; week >= 0; week -= 1) {
    for (let index = 0; index < SHIFTS_PER_WEEK; index += 1) {
      const dayOffset = week * 7 - random.int(0, 6);
      if (dayOffset < 0) continue;

      const date = startOfDay(new Date(today.getTime() - dayOffset * 86_400_000));
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;

      const startHour = isWeekend
        ? random.pick([10, 11, 11, 13, 14, 15])
        : random.pick([9, 10, 15, 16, 17, 18]);
      const durationHours = random.pick([3, 4, 4, 5]);

      const start = new Date(date);
      start.setHours(startHour, 0, 0, 0);
      const end = new Date(start.getTime() + durationHours * 3_600_000);

      const salesUser = random.pick(salesRows);
      const salesProfile =
        SALES_USERS[salesRows.findIndex((row) => row.id === salesUser.id)] ??
        SALES_USERS[0]!;
      const location = random.pick(locationRows);
      const weather = random.pick([
        "sunny", "sunny", "cloudy", "cloudy", "rainy", "hot", "cold",
      ] as const);

      const quality =
        (VENUE_QUALITY[location.venueType] ?? 1) *
        (TIME_BAND_QUALITY[timeBandOf(startHour)] ?? 1) *
        (WEATHER_QUALITY[weather] ?? 1) *
        (isWeekend ? 1.25 : 0.85) *
        salesProfile.skill;

      const approachesPerHour = 18 + random.int(0, 8);
      const approachCount = Math.round(
        approachesPerHour * durationHours * (0.85 + salesProfile.skill * 0.2),
      );
      const stopRate = Math.min(0.4, 0.11 * quality);
      const stoppedCount = Math.round(approachCount * stopRate);
      const scanCount = Math.round(stoppedCount * Math.min(0.75, 0.42 * quality));

      const [shift] = await db
        .insert(shifts)
        .values({
          salesUserId: salesUser.id,
          locationId: location.id,
          startTime: start,
          plannedEndTime: end,
          endTime: end,
          weather,
          venueType: location.venueType as never,
          status: "ended",
          approachCount,
          stoppedCount,
          memo: null,
          createdAt: start,
          updatedAt: end,
        })
        .returning({ id: shifts.id });

      const qrToken = generateToken(9);
      await db.insert(qrCodes).values({
        token: qrToken,
        shiftId: shift!.id,
        salesUserId: salesUser.id,
        locationId: location.id,
        createdAt: start,
      });

      /* A small amount of direct spend so the cost side is not always zero. */
      if (random.chance(0.35)) {
        await db.insert(acquisitionCosts).values({
          incurredOn: start.toISOString().slice(0, 10),
          category: random.pick(["場所使用料", "チラシ・備品", "交通費"]),
          amountYen: random.int(2, 12) * 1_000,
          locationId: location.id,
          shiftId: shift!.id,
        });
      }

      plans.push({
        shiftId: shift!.id,
        qrToken,
        start,
        end,
        quality,
        scanCount,
      });
    }
  }

  return plans;
}

/**
 * Anchors the answered salary band to the occupation's own benchmark so the
 * demo data never implies a 3x uplift that only exists because the seed put a
 * senior engineer on a trainee salary.
 */
function salaryBandFor(
  occupationCode: string,
  experienceBand: string,
  random: Random,
): string {
  const occupation = OCCUPATIONS.find((entry) => entry.code === occupationCode);
  const base = occupation?.baseSalary ?? 4_000_000;
  /* Street-acquired candidates skew below market: that is the business premise. */
  const actual =
    base * (BAND_MULTIPLIER[experienceBand] ?? 1) * (0.72 + random.next() * 0.28);

  const band = SALARY_BAND_BOUNDS.find((entry) => actual < entry.upperYen);
  return band?.value ?? "gte1000";
}

const SALARY_BAND_BOUNDS = [
  { value: "lt300", upperYen: 3_000_000 },
  { value: "300_350", upperYen: 3_500_000 },
  { value: "350_400", upperYen: 4_000_000 },
  { value: "400_450", upperYen: 4_500_000 },
  { value: "450_500", upperYen: 5_000_000 },
  { value: "500_600", upperYen: 6_000_000 },
  { value: "600_700", upperYen: 7_000_000 },
  { value: "700_800", upperYen: 8_000_000 },
  { value: "800_1000", upperYen: 10_000_000 },
] as const;

function buildAnswers(
  random: Random,
  occupationByCode: Map<string, { id: number; code: string }>,
  skillByCode: Map<string, { id: number }>,
  certificationByCode: Map<string, { id: number }>,
  regionRows: { id: number; code: string }[],
): DiagnosisAnswers {
  const occupationCode = random.pick(
    Object.keys(OCCUPATION_SKILLS).filter((code) => code !== "field_service"),
  );
  const ownSkills = OCCUPATION_SKILLS[occupationCode] ?? [];
  const ownCertifications = OCCUPATION_CERTIFICATIONS[occupationCode] ?? [];

  const skillIds = random
    .sample(ownSkills, random.int(Math.min(3, ownSkills.length), ownSkills.length))
    .map(([code]) => skillByCode.get(code)!.id);

  /* A few candidates carry a transferable skill from outside their own job. */
  if (random.chance(0.35)) {
    const extra = random.pick(SKILLS).code;
    const id = skillByCode.get(extra)?.id;
    if (id && !skillIds.includes(id)) skillIds.push(id);
  }

  const certificationIds = random
    .sample(ownCertifications, random.int(0, ownCertifications.length))
    .map(([code]) => certificationByCode.get(code)!.id);
  if (random.chance(0.7)) {
    const license = certificationByCode.get("driver_license");
    if (license && !certificationIds.includes(license.id)) {
      certificationIds.push(license.id);
    }
  }

  /* Some people already do adjacent work; they are the top of the market. */
  const adjacent = TRANSITIONS.filter((rule) => rule.source === occupationCode);
  if (adjacent.length > 0 && random.chance(0.18)) {
    const target = random.pick(adjacent).target;
    for (const [code] of OCCUPATION_SKILLS[target] ?? []) {
      const id = skillByCode.get(code)?.id;
      if (id && !skillIds.includes(id)) skillIds.push(id);
    }
    for (const [code] of OCCUPATION_CERTIFICATIONS[target] ?? []) {
      const id = certificationByCode.get(code)?.id;
      if (id && !certificationIds.includes(id) && random.chance(0.7)) {
        certificationIds.push(id);
      }
    }
  }

  const homeRegion = random.pick(regionRows);
  const desiredRegions = random.chance(0.6)
    ? [homeRegion.id]
    : random.sample(regionRows, random.int(1, 2)).map((region) => region.id);

  const experienceBand = random.pick([
    "0-2", "3-5", "3-5", "6-9", "6-9", "10-14", "15+",
  ]);

  return {
    currentSalaryBand: salaryBandFor(occupationCode, experienceBand, random),
    currentOccupationId: occupationByCode.get(occupationCode)!.id,
    currentIndustry: random.pick([
      "automotive", "manufacturing", "construction", "energy", "logistics", "service",
    ]),
    experienceBand,
    skillIds,
    certificationIds,
    managementBand: random.pick(["none", "none", "none", "1_2", "3_5", "6plus"]),
    employmentType: random.pick([
      "full_time", "full_time", "full_time", "contract", "dispatch",
    ]),
    currentRegionId: homeRegion.id,
    desiredRegionIds: desiredRegions,
    relocationOk: random.chance(0.28),
    travelOk: random.chance(0.6),
    nightShiftOk: random.chance(0.4),
    educationLevel: random.pick([
      "high_school", "high_school", "vocational", "vocational", "associate", "bachelor",
    ]),
    desiredConditions: random.sample(
      ["salary_up", "work_life", "commute", "stability", "skill_up", "no_night_shift"],
      random.int(1, 3),
    ),
    desiredTiming: random.pick(["asap", "1_3m", "3_6m", "3_6m", "6_12m", "undecided"]),
  } as DiagnosisAnswers;
}

async function simulateFunnel(
  db: Database,
  random: Random,
  plans: ShiftPlan[],
  master: Awaited<ReturnType<typeof seedMasterData>>,
  companyRows: { id: number }[],
  adminId: string,
  today: Date,
): Promise<number> {
  let candidateCount = 0;

  for (const plan of plans) {
    /* Cap materialised candidates: the shift counters keep the real volume. */
    const scans = Math.min(plan.scanCount, 10);

    for (let index = 0; index < scans; index += 1) {
      const scanAt = new Date(
        plan.start.getTime() +
          random.next() * Math.max(1, plan.end.getTime() - plan.start.getTime()),
      );

      const scan = await handleQrScan(db, plan.qrToken, null, scanAt);
      if (!scan) continue;
      candidateCount += 1;

      if (!random.chance(0.86)) continue;
      const startAt = new Date(scanAt.getTime() + random.int(20, 180) * 1000);
      const { diagnosisId } = await startDiagnosis(db, scan.candidateId, startAt);

      if (!random.chance(0.74)) continue;
      const completeAt = new Date(startAt.getTime() + random.int(60, 300) * 1000);
      const answers = buildAnswers(
        random,
        master.occupationByCode,
        master.skillByCode,
        master.certificationByCode,
        master.regionRows,
      );
      await completeDiagnosis(db, scan.candidateId, diagnosisId, answers, completeAt);

      if (!random.chance(0.44)) continue;
      const leadAt = new Date(completeAt.getTime() + random.int(60, 900) * 1000);
      const name = `${random.pick(FAMILY_NAMES)} ${random.pick(GIVEN_NAMES)}`;
      await registerLead(
        db,
        scan.candidateId,
        {
          fullName: name,
          email: `candidate${candidateCount}@example.com`,
          phone: `090-0000-${String(1000 + candidateCount).slice(-4)}`,
          birthYear: random.int(1978, 2003),
          preferredContact: random.pick(["email", "phone"]),
        },
        leadAt,
      );

      if (!random.chance(0.62)) continue;
      const bookedAt = new Date(leadAt.getTime() + random.int(1, 40) * 60_000);
      const scheduledAt = new Date(bookedAt.getTime() + random.int(1, 7) * 86_400_000);
      const bookingId = await bookInterview(
        db,
        scan.candidateId,
        scheduledAt,
        `${scheduledAt.getMonth() + 1}/${scheduledAt.getDate()} ${scheduledAt.getHours()}:00`,
        bookedAt,
      );

      if (scheduledAt > today) continue;
      if (!random.chance(0.72)) continue;
      await completeInterview(db, bookingId, adminId, scheduledAt);

      const recommendations = await buildRecommendations(
        db,
        scan.candidateId,
        new Date(scheduledAt.getTime() + 3_600_000),
      );
      if (recommendations.length === 0) continue;
      if (!random.chance(0.78)) continue;

      const chosen = random
        .sample(recommendations.slice(0, 3), random.int(1, 2))
        .map((recommendation) => recommendation.agentCompanyId);
      const referredAt = new Date(scheduledAt.getTime() + random.int(2, 48) * 3_600_000);
      const referralIds = await referCandidate(db, scan.candidateId, chosen, referredAt);

      for (const referralId of referralIds) {
        await progressReferral(db, random, referralId, referredAt, today, adminId);
      }
    }
  }

  void companyRows;
  return candidateCount;
}

async function progressReferral(
  db: Database,
  random: Random,
  referralId: number,
  referredAt: Date,
  today: Date,
  adminId: string,
): Promise<void> {
  let at = new Date(referredAt.getTime() + random.int(2, 36) * 3_600_000);
  if (at > today) return;

  if (!random.chance(0.85)) {
    await updateReferralStatus(db, referralId, "declined", adminId, {}, at);
    return;
  }
  await updateReferralStatus(db, referralId, "accepted", adminId, {}, at);

  at = new Date(at.getTime() + random.int(1, 4) * 86_400_000);
  if (at > today || !random.chance(0.9)) return;
  await updateReferralStatus(db, referralId, "contacted", adminId, {}, at);

  at = new Date(at.getTime() + random.int(2, 10) * 86_400_000);
  if (at > today || !random.chance(0.72)) return;
  await updateReferralStatus(db, referralId, "interview_completed", adminId, {}, at);

  at = new Date(at.getTime() + random.int(3, 14) * 86_400_000);
  if (at > today || !random.chance(0.55)) return;
  await updateReferralStatus(db, referralId, "applied", adminId, {}, at);

  at = new Date(at.getTime() + random.int(7, 21) * 86_400_000);
  if (at > today || !random.chance(0.34)) {
    if (at <= today && random.chance(0.4)) {
      await updateReferralStatus(
        db,
        referralId,
        "lost",
        adminId,
        { lostReason: random.pick(["選考見送り", "候補者辞退", "条件不一致"]) },
        at,
      );
    }
    return;
  }

  const offerSalary = roundTo(random.int(430, 720) * 10_000, 100_000);
  await updateReferralStatus(
    db,
    referralId,
    "offer",
    adminId,
    {
      offerCompany: random.pick([
        "株式会社カンサイテクノ", "西日本産業機械", "大阪メンテナンス工業",
        "ヒョウゴエンジニアリング", "北摂プラントサービス",
      ]),
      offerJobTitle: random.pick([
        "フィールドサービスエンジニア", "設備保全", "産業機械サービス", "施工管理",
      ]),
      offerSalaryYen: offerSalary,
      offerDate: at.toISOString().slice(0, 10),
    },
    at,
  );

  at = new Date(at.getTime() + random.int(14, 45) * 86_400_000);
  if (at > today || !random.chance(0.66)) return;
  await updateReferralStatus(
    db,
    referralId,
    "joined",
    adminId,
    { joinedDate: at.toISOString().slice(0, 10) },
    at,
  );
}

/* -------------------------------------------------------------------------- */

const db = await getDb();
await runMigrations(db);

console.log(`driver: ${resolveDriver()}`);
console.log("truncating...");
await truncateAll(db);

console.log("seeding master data...");
const master = await seedMasterData(db);

console.log("seeding users and agents...");
const { admin, salesRows, companyRows } = await seedUsers(
  db,
  master.regionByCode,
  master.occupationByCode,
);

const random = createRandom(20260824);
const today = new Date();

console.log("seeding shifts...");
const plans = await seedShifts(db, random, salesRows, master.locationRows, today);

console.log(`simulating candidate funnel across ${plans.length} shifts...`);
const candidateCount = await simulateFunnel(
  db,
  random,
  plans,
  master,
  companyRows,
  admin.id,
  today,
);

/* Confirm the revenue that is old enough for an agency to have actually paid. */
await db.execute(sql`
  update revenue_events
  set status = 'confirmed', confirmed_at = occurred_at + interval '30 days'
  where status = 'estimated' and occurred_at < now() - interval '30 days'
`);
await db.execute(sql`
  update incentive_ledger
  set status = 'approved', approved_at = occurred_at + interval '7 days'
  where status = 'pending' and occurred_at < now() - interval '14 days'
`);

console.log(`
seed complete
  shifts     : ${plans.length}
  candidates : ${candidateCount}
  login      : admin@example.com / ${SEED_PASSWORD}
`);
process.exit(0);
