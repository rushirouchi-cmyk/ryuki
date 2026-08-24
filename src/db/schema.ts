/**
 * Career Routing Engine — database schema.
 *
 * Design principle: everything hangs off `candidates`. A candidate row is created
 * at anonymous diagnosis start (no PII required) and keeps the same id through
 * lead registration, interview, agent referral and outcome.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */

export const userRoleEnum = pgEnum('user_role', ['admin', 'sales', 'agent']);

export const venueTypeEnum = pgEnum('venue_type', [
  'shopping_mall',
  'station',
  'shopping_street',
  'residential_area',
  'park',
  'supermarket',
  'home_center',
  'event',
  'other',
]);

export const weatherEnum = pgEnum('weather', ['sunny', 'cloudy', 'rainy', 'snowy', 'windy']);

export const shiftStatusEnum = pgEnum('shift_status', ['active', 'closed']);

export const experienceBandEnum = pgEnum('experience_band', ['0-2', '3-5', '6-9', '10-14', '15+']);

export const educationLevelEnum = pgEnum('education_level', [
  'high_school',
  'vocational',
  'associate',
  'bachelor',
  'master',
  'other',
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'contract',
  'dispatch',
  'part_time',
  'freelance',
  'unemployed',
]);

export const valueRankEnum = pgEnum('value_rank', ['S', 'A', 'B', 'C']);

export const confidenceLevelEnum = pgEnum('confidence_level', ['low', 'medium', 'high']);

export const candidateStatusEnum = pgEnum('candidate_status', [
  'anonymous',
  'diagnosed',
  'lead',
  'interview_booked',
  'interview_completed',
  'qualified',
  'referred',
  'joined',
  'lost',
]);

export const candidateEventTypeEnum = pgEnum('candidate_event_type', [
  'qr_scanned',
  'diagnosis_started',
  'diagnosis_completed',
  'lead_registered',
  'interview_booked',
  'interview_completed',
  'candidate_qualified',
  'agent_recommended',
  'consent_given',
  'agent_referred',
  'agent_accepted',
  'agent_declined',
  'agent_interview_completed',
  'applied',
  'offer_received',
  'joined',
  'lost',
]);

export const referralStatusEnum = pgEnum('referral_status', [
  'referred',
  'accepted',
  'declined',
  'contacted',
  'interview_scheduled',
  'interview_completed',
  'application',
  'offer',
  'joined',
  'lost',
]);

export const interviewStatusEnum = pgEnum('interview_status', [
  'booked',
  'completed',
  'no_show',
  'cancelled',
]);

export const incentiveStatusEnum = pgEnum('incentive_status', [
  'pending',
  'approved',
  'rejected',
  'paid',
]);

export const revenueStatusEnum = pgEnum('revenue_status', ['estimated', 'confirmed']);

/** Events that can trigger a sales incentive or an agent fee. */
export const monetizableEventEnum = pgEnum('monetizable_event', [
  'diagnosis_completed',
  'lead_registered',
  'interview_booked',
  'interview_completed',
  'candidate_qualified',
  'agent_referred',
  'agent_accepted',
  'agent_interview_completed',
  'offer',
  'joined',
]);

/* ------------------------------------------------------------- identities */

export const agentCompanies = pgTable('agent_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }),
  /** occupation ids this agent is strong at */
  specialtyOccupationIds: jsonb('specialty_occupation_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  /** region ids this agent covers */
  coverageRegionIds: jsonb('coverage_region_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  minSalaryFocus: integer('min_salary_focus'),
  maxSalaryFocus: integer('max_salary_focus'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    role: userRoleEnum('role').notNull(),
    /** only for role = agent */
    agentCompanyId: uuid('agent_company_id').references(() => agentCompanies.id),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    actorRole: userRoleEnum('actor_role'),
    action: varchar('action', { length: 120 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 80 }),
    /** never store raw PII here */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt), index('audit_logs_entity_idx').on(t.entityType, t.entityId)],
);

/* --------------------------------------------------------- career masters */

export const regions = pgTable('regions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 80 }).notNull(),
  prefecture: varchar('prefecture', { length: 40 }).notNull(),
  /** national fallback row used when no regional benchmark exists */
  isNationalFallback: boolean('is_national_fallback').notNull().default(false),
});

export const occupations = pgTable('occupations', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 60 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
});

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 60 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
});

export const certifications = pgTable('certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 60 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
});

export const occupationSkills = pgTable(
  'occupation_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occupationId: uuid('occupation_id')
      .notNull()
      .references(() => occupations.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    /** 0.0 - 1.0 */
    importanceWeight: numeric('importance_weight', { precision: 4, scale: 3 }).notNull().default('0.500'),
  },
  (t) => [uniqueIndex('occupation_skills_unique').on(t.occupationId, t.skillId)],
);

export const occupationCertifications = pgTable(
  'occupation_certifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occupationId: uuid('occupation_id')
      .notNull()
      .references(() => occupations.id, { onDelete: 'cascade' }),
    certificationId: uuid('certification_id')
      .notNull()
      .references(() => certifications.id, { onDelete: 'cascade' }),
    /** 0.0 - 1.0 */
    importanceWeight: numeric('importance_weight', { precision: 4, scale: 3 }).notNull().default('0.500'),
  },
  (t) => [uniqueIndex('occupation_certifications_unique').on(t.occupationId, t.certificationId)],
);

export const careerTransitionRules = pgTable(
  'career_transition_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceOccupationId: uuid('source_occupation_id')
      .notNull()
      .references(() => occupations.id, { onDelete: 'cascade' }),
    targetOccupationId: uuid('target_occupation_id')
      .notNull()
      .references(() => occupations.id, { onDelete: 'cascade' }),
    /** 0-100 baseline affinity between the two occupations */
    baseTransitionScore: integer('base_transition_score').notNull().default(50),
    requiredSkillIds: jsonb('required_skill_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    preferredSkillIds: jsonb('preferred_skill_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    requiredCertificationIds: jsonb('required_certification_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    preferredCertificationIds: jsonb('preferred_certification_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    minimumExperienceYears: integer('minimum_experience_years').notNull().default(0),
    /** working conditions the target role typically demands */
    requiresRelocation: boolean('requires_relocation').notNull().default(false),
    requiresBusinessTrip: boolean('requires_business_trip').notNull().default(false),
    requiresNightShift: boolean('requires_night_shift').notNull().default(false),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('career_transition_rules_unique').on(t.sourceOccupationId, t.targetOccupationId),
    index('career_transition_rules_source_idx').on(t.sourceOccupationId),
  ],
);

export const salaryMarketBenchmarks = pgTable(
  'salary_market_benchmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occupationId: uuid('occupation_id')
      .notNull()
      .references(() => occupations.id, { onDelete: 'cascade' }),
    regionId: uuid('region_id')
      .notNull()
      .references(() => regions.id, { onDelete: 'cascade' }),
    experienceBand: experienceBandEnum('experience_band').notNull(),
    educationLevel: educationLevelEnum('education_level'),
    /** annual salary in JPY */
    salaryLow: integer('salary_low').notNull(),
    salaryMedian: integer('salary_median').notNull(),
    salaryHigh: integer('salary_high').notNull(),
    /** abstracted data source: 'manual' | 'public_statistics' | 'job_posting' | 'internal_outcome' */
    source: varchar('source', { length: 60 }).notNull().default('manual'),
    sourceDate: date('source_date').notNull(),
    confidenceLevel: confidenceLevelEnum('confidence_level').notNull().default('medium'),
    sampleSize: integer('sample_size'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('salary_benchmark_unique').on(t.occupationId, t.regionId, t.experienceBand, t.educationLevel),
    index('salary_benchmark_lookup_idx').on(t.occupationId, t.regionId),
  ],
);

/* ------------------------------------------------------------- acquisition */

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prefecture: varchar('prefecture', { length: 40 }).notNull(),
    city: varchar('city', { length: 80 }).notNull(),
    district: varchar('district', { length: 80 }),
    venueName: varchar('venue_name', { length: 160 }).notNull(),
    venueType: venueTypeEnum('venue_type').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    stationName: varchar('station_name', { length: 120 }),
    regionId: uuid('region_id').references(() => regions.id),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('locations_active_idx').on(t.active)],
);

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesUserId: uuid('sales_user_id')
      .notNull()
      .references(() => users.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    plannedEndTime: timestamp('planned_end_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    weather: weatherEnum('weather'),
    venueType: venueTypeEnum('venue_type').notNull(),
    memo: text('memo'),
    status: shiftStatusEnum('status').notNull().default('active'),
    /** manually tapped by the sales rep on the street */
    approachCount: integer('approach_count').notNull().default(0),
    stoppedCount: integer('stopped_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shifts_sales_user_idx').on(t.salesUserId),
    index('shifts_start_idx').on(t.startTime),
    index('shifts_location_idx').on(t.locationId),
  ],
);

export const qrCodes = pgTable(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** public token embedded in /d/{token}; carries no PII */
    token: varchar('token', { length: 40 }).notNull(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    salesUserId: uuid('sales_user_id')
      .notNull()
      .references(() => users.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('qr_codes_token_unique').on(t.token), index('qr_codes_shift_idx').on(t.shiftId)],
);

/* -------------------------------------------------------------- candidate */

export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** unguessable token used for /diagnosis/result/{token} and the candidate magic link */
    publicToken: varchar('public_token', { length: 40 }).notNull(),
    status: candidateStatusEnum('status').notNull().default('anonymous'),
    /* PII — null until the candidate opts in */
    fullName: varchar('full_name', { length: 120 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 40 }),
    birthYear: integer('birth_year'),
    /* non-PII profile captured during anonymous diagnosis */
    prefecture: varchar('prefecture', { length: 40 }),
    desiredPrefectures: jsonb('desired_prefectures').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ageBand: varchar('age_band', { length: 20 }),
    jobChangeTiming: varchar('job_change_timing', { length: 40 }),
    qualified: boolean('qualified').notNull().default(false),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    leadRegisteredAt: timestamp('lead_registered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('candidates_public_token_unique').on(t.publicToken),
    index('candidates_status_idx').on(t.status),
    index('candidates_created_idx').on(t.createdAt),
  ],
);

/**
 * One row per candidate — this is what makes "first valid attribution" a
 * database-level guarantee rather than application etiquette.
 */
export const candidateAttributions = pgTable(
  'candidate_attributions',
  {
    candidateId: uuid('candidate_id')
      .primaryKey()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
    salesUserId: uuid('sales_user_id').references(() => users.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    locationId: uuid('location_id').references(() => locations.id),
    /** 'qr' | 'direct' | 'admin_override' */
    source: varchar('source', { length: 30 }).notNull().default('qr'),
    attributedAt: timestamp('attributed_at', { withTimezone: true }).notNull().defaultNow(),
    overriddenByUserId: uuid('overridden_by_user_id').references(() => users.id),
    overrideReason: text('override_reason'),
  },
  (t) => [index('candidate_attr_sales_idx').on(t.salesUserId), index('candidate_attr_shift_idx').on(t.shiftId)],
);

export const scanEvents = pgTable(
  'scan_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    qrCodeId: uuid('qr_code_id')
      .notNull()
      .references(() => qrCodes.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id').references(() => candidates.id, { onDelete: 'set null' }),
    /** hashed, never the raw value */
    visitorHash: varchar('visitor_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scan_events_qr_idx').on(t.qrCodeId), index('scan_events_created_idx').on(t.createdAt)],
);

export const candidateEvents = pgTable(
  'candidate_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    eventType: candidateEventTypeEnum('event_type').notNull(),
    userId: uuid('user_id').references(() => users.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    locationId: uuid('location_id').references(() => locations.id),
    agentCompanyId: uuid('agent_company_id').references(() => agentCompanies.id),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('candidate_events_candidate_idx').on(t.candidateId),
    index('candidate_events_type_idx').on(t.eventType),
    index('candidate_events_created_idx').on(t.createdAt),
    index('candidate_events_shift_idx').on(t.shiftId),
  ],
);

/* -------------------------------------------------------------- diagnosis */

export const diagnoses = pgTable(
  'diagnoses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    /** raw answers, kept so the engine can be re-run when masters change */
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    currentOccupationId: uuid('current_occupation_id').references(() => occupations.id),
    regionId: uuid('region_id').references(() => regions.id),
    experienceBand: experienceBandEnum('experience_band'),
    currentSalary: integer('current_salary'),
    currentMarketMedian: integer('current_market_median'),
    estimatedSalaryLow: integer('estimated_salary_low'),
    estimatedSalaryHigh: integer('estimated_salary_high'),
    improvementLow: integer('improvement_low'),
    improvementHigh: integer('improvement_high'),
    valueRank: valueRankEnum('value_rank'),
    bestMatchScore: integer('best_match_score'),
    /** full explainable result payload rendered on the result screen */
    result: jsonb('result').$type<Record<string, unknown>>(),
    /** snapshot of the scoring config used, so old results stay reproducible */
    configSnapshot: jsonb('config_snapshot').$type<Record<string, unknown>>(),
    engineVersion: varchar('engine_version', { length: 20 }).notNull().default('1.0.0'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('diagnoses_candidate_idx').on(t.candidateId), index('diagnoses_completed_idx').on(t.completedAt)],
);

export const diagnosisOccupationMatches = pgTable(
  'diagnosis_occupation_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diagnosisId: uuid('diagnosis_id')
      .notNull()
      .references(() => diagnoses.id, { onDelete: 'cascade' }),
    occupationId: uuid('occupation_id')
      .notNull()
      .references(() => occupations.id),
    isCurrentOccupation: boolean('is_current_occupation').notNull().default(false),
    matchScore: integer('match_score').notNull(),
    /** per-component score breakdown — this is what makes the result explainable */
    breakdown: jsonb('breakdown').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    salaryLow: integer('salary_low'),
    salaryMedian: integer('salary_median'),
    salaryHigh: integer('salary_high'),
    rankPosition: integer('rank_position').notNull(),
  },
  (t) => [index('diagnosis_matches_diagnosis_idx').on(t.diagnosisId)],
);

/* ------------------------------------------------------------- conversion */

export const interviews = pgTable(
  'interviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: interviewStatusEnum('status').notNull().default('booked'),
    mode: varchar('mode', { length: 30 }).notNull().default('online'),
    assignedUserId: uuid('assigned_user_id').references(() => users.id),
    notes: text('notes'),
    bookedAt: timestamp('booked_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('interviews_candidate_idx').on(t.candidateId), index('interviews_scheduled_idx').on(t.scheduledAt)],
);

/* ---------------------------------------------------------- agent routing */

export const agentRecommendations = pgTable(
  'agent_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    agentCompanyId: uuid('agent_company_id')
      .notNull()
      .references(() => agentCompanies.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    breakdown: jsonb('breakdown').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    rankPosition: integer('rank_position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('agent_reco_unique').on(t.candidateId, t.agentCompanyId)],
);

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    agentCompanyId: uuid('agent_company_id')
      .notNull()
      .references(() => agentCompanies.id),
    /** 'third_party_provision' */
    consentType: varchar('consent_type', { length: 60 }).notNull().default('third_party_provision'),
    /** exact wording shown to the candidate at the time of consent */
    consentText: text('consent_text').notNull(),
    consentVersion: varchar('consent_version', { length: 20 }).notNull().default('1.0'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('consents_unique').on(t.candidateId, t.agentCompanyId, t.consentType),
    index('consents_candidate_idx').on(t.candidateId),
  ],
);

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    agentCompanyId: uuid('agent_company_id')
      .notNull()
      .references(() => agentCompanies.id),
    consentId: uuid('consent_id')
      .notNull()
      .references(() => consents.id),
    status: referralStatusEnum('status').notNull().default('referred'),
    referredAt: timestamp('referred_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    contactedAt: timestamp('contacted_at', { withTimezone: true }),
    interviewScheduledAt: timestamp('interview_scheduled_at', { withTimezone: true }),
    interviewCompletedAt: timestamp('interview_completed_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    offerAt: timestamp('offer_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    /* outcome — training data for future salary models */
    offerCompanyName: varchar('offer_company_name', { length: 200 }),
    offerJobTitle: varchar('offer_job_title', { length: 200 }),
    offerOccupationId: uuid('offer_occupation_id').references(() => occupations.id),
    offerSalary: integer('offer_salary'),
    offerDate: date('offer_date'),
    joinedDate: date('joined_date'),
    lostReason: varchar('lost_reason', { length: 200 }),
    notes: text('notes'),
  },
  (t) => [
    uniqueIndex('referrals_unique').on(t.candidateId, t.agentCompanyId),
    index('referrals_agent_idx').on(t.agentCompanyId),
    index('referrals_status_idx').on(t.status),
  ],
);

/* ---------------------------------------------------------------- revenue */

export const agentFeeRules = pgTable(
  'agent_fee_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentCompanyId: uuid('agent_company_id')
      .notNull()
      .references(() => agentCompanies.id, { onDelete: 'cascade' }),
    eventType: monetizableEventEnum('event_type').notNull(),
    amount: integer('amount').notNull(),
    /** when set, amount is a % of offer salary instead of a flat fee */
    percentOfOfferSalary: numeric('percent_of_offer_salary', { precision: 5, scale: 2 }),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('agent_fee_rules_agent_idx').on(t.agentCompanyId, t.eventType)],
);

export const revenueEvents = pgTable(
  'revenue_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    agentCompanyId: uuid('agent_company_id')
      .notNull()
      .references(() => agentCompanies.id),
    referralId: uuid('referral_id').references(() => referrals.id, { onDelete: 'cascade' }),
    feeRuleId: uuid('fee_rule_id').references(() => agentFeeRules.id),
    eventType: monetizableEventEnum('event_type').notNull(),
    amount: integer('amount').notNull(),
    status: revenueStatusEnum('status').notNull().default('estimated'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('revenue_events_unique').on(t.candidateId, t.agentCompanyId, t.eventType),
    index('revenue_events_occurred_idx').on(t.occurredAt),
  ],
);

/* ------------------------------------------------------------- incentives */

export const incentiveRules = pgTable(
  'incentive_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: monetizableEventEnum('event_type').notNull(),
    amount: integer('amount').notNull(),
    description: varchar('description', { length: 200 }),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    /** e.g. { "minMatchScore": 55, "venueTypes": ["shopping_mall"] } */
    conditions: jsonb('conditions').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('incentive_rules_event_idx').on(t.eventType, t.active)],
);

export const incentiveLedger = pgTable(
  'incentive_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesUserId: uuid('sales_user_id')
      .notNull()
      .references(() => users.id),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id').references(() => shifts.id),
    eventType: monetizableEventEnum('event_type').notNull(),
    amount: integer('amount').notNull(),
    ruleId: uuid('rule_id').references(() => incentiveRules.id),
    status: incentiveStatusEnum('status').notNull().default('pending'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    rejectedReason: varchar('rejected_reason', { length: 200 }),
  },
  (t) => [
    /** hard guarantee against double counting the same event for the same candidate */
    uniqueIndex('incentive_ledger_unique').on(t.candidateId, t.eventType),
    index('incentive_ledger_sales_idx').on(t.salesUserId),
    index('incentive_ledger_occurred_idx').on(t.occurredAt),
  ],
);

/* ---------------------------------------------------------------- settings */

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  description: varchar('description', { length: 300 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
});

/* --------------------------------------------------------------- relations */

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  attribution: one(candidateAttributions, {
    fields: [candidates.id],
    references: [candidateAttributions.candidateId],
  }),
  diagnoses: many(diagnoses),
  events: many(candidateEvents),
  interviews: many(interviews),
  recommendations: many(agentRecommendations),
  consents: many(consents),
  referrals: many(referrals),
  revenueEvents: many(revenueEvents),
  incentives: many(incentiveLedger),
}));

export const diagnosesRelations = relations(diagnoses, ({ one, many }) => ({
  candidate: one(candidates, { fields: [diagnoses.candidateId], references: [candidates.id] }),
  matches: many(diagnosisOccupationMatches),
}));

export const diagnosisMatchesRelations = relations(diagnosisOccupationMatches, ({ one }) => ({
  diagnosis: one(diagnoses, {
    fields: [diagnosisOccupationMatches.diagnosisId],
    references: [diagnoses.id],
  }),
  occupation: one(occupations, {
    fields: [diagnosisOccupationMatches.occupationId],
    references: [occupations.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  salesUser: one(users, { fields: [shifts.salesUserId], references: [users.id] }),
  location: one(locations, { fields: [shifts.locationId], references: [locations.id] }),
  qrCodes: many(qrCodes),
}));

export const referralsRelations = relations(referrals, ({ one, many }) => ({
  candidate: one(candidates, { fields: [referrals.candidateId], references: [candidates.id] }),
  agentCompany: one(agentCompanies, {
    fields: [referrals.agentCompanyId],
    references: [agentCompanies.id],
  }),
  revenueEvents: many(revenueEvents),
}));

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  shift: one(shifts, { fields: [qrCodes.shiftId], references: [shifts.id] }),
  location: one(locations, { fields: [qrCodes.locationId], references: [locations.id] }),
  salesUser: one(users, { fields: [qrCodes.salesUserId], references: [users.id] }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  region: one(regions, { fields: [locations.regionId], references: [regions.id] }),
  shifts: many(shifts),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  candidate: one(candidates, { fields: [interviews.candidateId], references: [candidates.id] }),
}));

export const incentiveLedgerRelations = relations(incentiveLedger, ({ one }) => ({
  salesUser: one(users, { fields: [incentiveLedger.salesUserId], references: [users.id] }),
  candidate: one(candidates, { fields: [incentiveLedger.candidateId], references: [candidates.id] }),
  rule: one(incentiveRules, { fields: [incentiveLedger.ruleId], references: [incentiveRules.id] }),
}));

export const candidateAttributionsRelations = relations(candidateAttributions, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateAttributions.candidateId],
    references: [candidates.id],
  }),
  salesUser: one(users, { fields: [candidateAttributions.salesUserId], references: [users.id] }),
  shift: one(shifts, { fields: [candidateAttributions.shiftId], references: [shifts.id] }),
  location: one(locations, { fields: [candidateAttributions.locationId], references: [locations.id] }),
}));

export const agentRecommendationsRelations = relations(agentRecommendations, ({ one }) => ({
  candidate: one(candidates, { fields: [agentRecommendations.candidateId], references: [candidates.id] }),
  agentCompany: one(agentCompanies, {
    fields: [agentRecommendations.agentCompanyId],
    references: [agentCompanies.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  agentCompany: one(agentCompanies, {
    fields: [users.agentCompanyId],
    references: [agentCompanies.id],
  }),
}));
