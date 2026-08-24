import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", ["admin", "sales", "agent"]);

export const venueTypeEnum = pgEnum("venue_type", [
  "shopping_mall",
  "station",
  "shopping_street",
  "residential_area",
  "park",
  "supermarket",
  "home_center",
  "event",
  "other",
]);

export const weatherEnum = pgEnum("weather", [
  "sunny",
  "cloudy",
  "rainy",
  "snowy",
  "hot",
  "cold",
]);

export const shiftStatusEnum = pgEnum("shift_status", ["active", "ended"]);

export const counterTypeEnum = pgEnum("counter_type", ["approach", "stopped"]);

export const experienceBandEnum = pgEnum("experience_band", [
  "0-2",
  "3-5",
  "6-9",
  "10-14",
  "15+",
]);

export const educationLevelEnum = pgEnum("education_level", [
  "high_school",
  "vocational",
  "associate",
  "bachelor",
  "master",
  "doctorate",
  "other",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "contract",
  "dispatch",
  "part_time",
  "self_employed",
  "other",
]);

export const confidenceLevelEnum = pgEnum("confidence_level", ["low", "medium", "high"]);

export const diagnosisStatusEnum = pgEnum("diagnosis_status", [
  "started",
  "completed",
  "abandoned",
]);

export const matchRankEnum = pgEnum("match_rank", ["S", "A", "B", "C"]);

export const candidateStageEnum = pgEnum("candidate_stage", [
  "anonymous",
  "diagnosed",
  "lead",
  "interview_booked",
  "interview_completed",
  "qualified",
  "referred",
  "outcome",
]);

export const attributionSourceEnum = pgEnum("attribution_source", [
  "qr",
  "manual",
  "direct",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "booked",
  "completed",
  "no_show",
  "cancelled",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "accepted",
  "declined",
  "contacted",
  "interview_scheduled",
  "interview_completed",
  "applied",
  "offer",
  "joined",
  "lost",
]);

export const revenueEventTypeEnum = pgEnum("revenue_event_type", [
  "agent_accepted",
  "agent_interview_completed",
  "offer",
  "joined",
]);

export const revenueStatusEnum = pgEnum("revenue_status", [
  "estimated",
  "confirmed",
  "cancelled",
]);

export const incentiveEventTypeEnum = pgEnum("incentive_event_type", [
  "diagnosis_completed",
  "lead_registered",
  "interview_booked",
  "interview_completed",
  "candidate_qualified",
  "agent_referred",
  "offer",
  "joined",
]);

export const incentiveStatusEnum = pgEnum("incentive_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

/**
 * Append-only funnel event vocabulary. Analytics must be derivable from this
 * log alone so the funnel can be reshaped without a schema migration.
 */
export const candidateEventTypeEnum = pgEnum("candidate_event_type", [
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
]);

/* -------------------------------------------------------------------------- */
/* Identity & access                                                          */
/* -------------------------------------------------------------------------- */

export const agentCompanies = pgTable("agent_companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull(),
    agentCompanyId: integer("agent_company_id").references(() => agentCompanies.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    role: text("role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

/** Business rules live in the DB, never hardcoded in UI components. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

/* -------------------------------------------------------------------------- */
/* Career master data                                                         */
/* -------------------------------------------------------------------------- */

export const regions = pgTable(
  "regions",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    prefecture: text("prefecture").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("regions_code_unique").on(t.code)],
);

export const occupations = pgTable(
  "occupations",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    /* Working-condition requirements, used by the condition match component. */
    requiresTravel: boolean("requires_travel").notNull().default(false),
    requiresNightShift: boolean("requires_night_shift").notNull().default(false),
    requiresRelocation: boolean("requires_relocation").notNull().default(false),
    /** Lowest education level normally accepted; null means no requirement. */
    minEducationLevel: educationLevelEnum("min_education_level"),
    /** Whether management experience is materially valued for this occupation. */
    managementRelevant: boolean("management_relevant").notNull().default(false),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("occupations_code_unique").on(t.code)],
);

export const skills = pgTable(
  "skills",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
  },
  (t) => [uniqueIndex("skills_code_unique").on(t.code)],
);

export const certifications = pgTable(
  "certifications",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
  },
  (t) => [uniqueIndex("certifications_code_unique").on(t.code)],
);

export const occupationSkills = pgTable(
  "occupation_skills",
  {
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    /** 0.0 - 1.0 relative importance of the skill for the occupation. */
    importanceWeight: numeric("importance_weight", { precision: 4, scale: 3 })
      .notNull()
      .default("0.500"),
  },
  (t) => [primaryKey({ columns: [t.occupationId, t.skillId] })],
);

export const occupationCertifications = pgTable(
  "occupation_certifications",
  {
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id, { onDelete: "cascade" }),
    certificationId: integer("certification_id")
      .notNull()
      .references(() => certifications.id, { onDelete: "cascade" }),
    importanceWeight: numeric("importance_weight", { precision: 4, scale: 3 })
      .notNull()
      .default("0.500"),
  },
  (t) => [primaryKey({ columns: [t.occupationId, t.certificationId] })],
);

export const careerTransitionRules = pgTable(
  "career_transition_rules",
  {
    id: serial("id").primaryKey(),
    sourceOccupationId: integer("source_occupation_id")
      .notNull()
      .references(() => occupations.id, { onDelete: "cascade" }),
    targetOccupationId: integer("target_occupation_id")
      .notNull()
      .references(() => occupations.id, { onDelete: "cascade" }),
    /** 0-100 baseline plausibility of the transition before candidate fit. */
    baseTransitionScore: integer("base_transition_score").notNull().default(50),
    requiredSkillIds: integer("required_skill_ids").array().notNull().default([]),
    preferredSkillIds: integer("preferred_skill_ids").array().notNull().default([]),
    requiredCertificationIds: integer("required_certification_ids")
      .array()
      .notNull()
      .default([]),
    preferredCertificationIds: integer("preferred_certification_ids")
      .array()
      .notNull()
      .default([]),
    minimumExperienceYears: integer("minimum_experience_years").notNull().default(0),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("career_transition_rules_pair_unique").on(
      t.sourceOccupationId,
      t.targetOccupationId,
    ),
    index("career_transition_rules_source_idx").on(t.sourceOccupationId),
  ],
);

/**
 * Market salary reference data. `source` / `sourceDate` / `confidenceLevel`
 * keep the provenance explicit so public statistics, job-board scrapes and our
 * own placement history can coexist behind one abstraction.
 */
export const salaryMarketBenchmarks = pgTable(
  "salary_market_benchmarks",
  {
    id: serial("id").primaryKey(),
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id, { onDelete: "cascade" }),
    regionId: integer("region_id").references(() => regions.id, { onDelete: "cascade" }),
    experienceBand: experienceBandEnum("experience_band").notNull(),
    educationLevel: educationLevelEnum("education_level"),
    /** Annual salary in JPY. */
    salaryLow: integer("salary_low").notNull(),
    salaryMedian: integer("salary_median").notNull(),
    salaryHigh: integer("salary_high").notNull(),
    source: text("source").notNull(),
    sourceDate: date("source_date").notNull(),
    confidenceLevel: confidenceLevelEnum("confidence_level").notNull().default("medium"),
    sampleSize: integer("sample_size"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("benchmarks_lookup_idx").on(t.occupationId, t.regionId, t.experienceBand),
  ],
);

/* -------------------------------------------------------------------------- */
/* Acquisition: locations, shifts, QR codes                                   */
/* -------------------------------------------------------------------------- */

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    regionId: integer("region_id").references(() => regions.id),
    prefecture: text("prefecture").notNull(),
    city: text("city").notNull(),
    district: text("district"),
    venueName: text("venue_name").notNull(),
    venueType: venueTypeEnum("venue_type").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    stationName: text("station_name"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("locations_active_idx").on(t.active)],
);

export const shifts = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
    salesUserId: uuid("sales_user_id")
      .notNull()
      .references(() => users.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    plannedEndTime: timestamp("planned_end_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    weather: weatherEnum("weather"),
    venueType: venueTypeEnum("venue_type").notNull(),
    memo: text("memo"),
    status: shiftStatusEnum("status").notNull().default("active"),
    /** Manually tapped counters. Everything downstream is derived from events. */
    approachCount: integer("approach_count").notNull().default(0),
    stoppedCount: integer("stopped_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shifts_sales_user_idx").on(t.salesUserId),
    index("shifts_location_idx").on(t.locationId),
    index("shifts_start_idx").on(t.startTime),
  ],
);

/** Every counter tap, including corrections (delta -1), stays auditable. */
export const shiftCounterEvents = pgTable(
  "shift_counter_events",
  {
    id: serial("id").primaryKey(),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    counterType: counterTypeEnum("counter_type").notNull(),
    delta: integer("delta").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shift_counter_events_shift_idx").on(t.shiftId)],
);

export const qrCodes = pgTable(
  "qr_codes",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    salesUserId: uuid("sales_user_id")
      .notNull()
      .references(() => users.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id),
    active: boolean("active").notNull().default(true),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("qr_codes_token_unique").on(t.token)],
);

/* -------------------------------------------------------------------------- */
/* Candidate                                                                  */
/* -------------------------------------------------------------------------- */

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unguessable token used in candidate-facing URLs (magic-link style). */
    publicToken: text("public_token").notNull(),
    stage: candidateStageEnum("stage").notNull().default("anonymous"),
    /* First valid attribution, frozen when the diagnosis starts. */
    qrCodeId: integer("qr_code_id").references(() => qrCodes.id),
    salesUserId: uuid("sales_user_id").references(() => users.id),
    shiftId: integer("shift_id").references(() => shifts.id),
    locationId: integer("location_id").references(() => locations.id),
    attributionSource: attributionSourceEnum("attribution_source")
      .notNull()
      .default("direct"),
    attributionLockedAt: timestamp("attribution_locked_at", { withTimezone: true }),
    attributionOverriddenBy: uuid("attribution_overridden_by").references(() => users.id),
    attributionOverrideReason: text("attribution_override_reason"),
    qualified: boolean("qualified").notNull().default(false),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("candidates_public_token_unique").on(t.publicToken),
    index("candidates_sales_user_idx").on(t.salesUserId),
    index("candidates_shift_idx").on(t.shiftId),
    index("candidates_created_idx").on(t.createdAt),
  ],
);

/** PII lives in its own table so it can be withheld until consent exists. */
export const candidateContacts = pgTable("candidate_contacts", {
  candidateId: uuid("candidate_id")
    .primaryKey()
    .references(() => candidates.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  fullNameKana: text("full_name_kana"),
  email: text("email").notNull(),
  phone: text("phone"),
  birthYear: integer("birth_year"),
  preferredContact: text("preferred_contact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const candidateEvents = pgTable(
  "candidate_events",
  {
    id: serial("id").primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    eventType: candidateEventTypeEnum("event_type").notNull(),
    userId: uuid("user_id").references(() => users.id),
    shiftId: integer("shift_id").references(() => shifts.id),
    locationId: integer("location_id").references(() => locations.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("candidate_events_candidate_idx").on(t.candidateId),
    index("candidate_events_type_created_idx").on(t.eventType, t.createdAt),
    index("candidate_events_shift_idx").on(t.shiftId),
  ],
);

export const scanEvents = pgTable(
  "scan_events",
  {
    id: serial("id").primaryKey(),
    qrCodeId: integer("qr_code_id")
      .notNull()
      .references(() => qrCodes.id, { onDelete: "cascade" }),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    salesUserId: uuid("sales_user_id")
      .notNull()
      .references(() => users.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id),
    candidateId: uuid("candidate_id").references(() => candidates.id, {
      onDelete: "set null",
    }),
    /** True only for the scan that established the candidate's attribution. */
    isAttributed: boolean("is_attributed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scan_events_qr_idx").on(t.qrCodeId),
    index("scan_events_shift_idx").on(t.shiftId),
    index("scan_events_created_idx").on(t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Diagnosis                                                                  */
/* -------------------------------------------------------------------------- */

export const diagnoses = pgTable(
  "diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    status: diagnosisStatusEnum("status").notNull().default("started"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /* Raw answers, kept verbatim so the engine can be re-run after tuning. */
    answers: jsonb("answers").$type<Record<string, unknown>>(),
    engineVersion: text("engine_version"),
    configSnapshot: jsonb("config_snapshot").$type<Record<string, unknown>>(),

    /* Normalised inputs */
    currentOccupationId: integer("current_occupation_id").references(() => occupations.id),
    currentSalaryYen: integer("current_salary_yen"),
    experienceYears: integer("experience_years"),
    experienceBand: experienceBandEnum("experience_band"),
    educationLevel: educationLevelEnum("education_level"),
    employmentType: employmentTypeEnum("employment_type"),
    managementYears: integer("management_years").notNull().default(0),
    currentRegionId: integer("current_region_id").references(() => regions.id),
    desiredRegionIds: integer("desired_region_ids").array().notNull().default([]),
    relocationOk: boolean("relocation_ok").notNull().default(false),
    travelOk: boolean("travel_ok").notNull().default(false),
    nightShiftOk: boolean("night_shift_ok").notNull().default(false),
    desiredConditions: text("desired_conditions").array().notNull().default([]),
    desiredTiming: text("desired_timing"),

    /* Engine output */
    currentMarketLow: integer("current_market_low"),
    currentMarketMedian: integer("current_market_median"),
    currentMarketHigh: integer("current_market_high"),
    estimatedSalaryLow: integer("estimated_salary_low"),
    estimatedSalaryHigh: integer("estimated_salary_high"),
    upliftLow: integer("uplift_low"),
    upliftHigh: integer("uplift_high"),
    bestMatchScore: integer("best_match_score"),
    matchRank: matchRankEnum("match_rank"),
    valuedExperiences: jsonb("valued_experiences").$type<string[]>(),
    dataConfidence: confidenceLevelEnum("data_confidence"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("diagnoses_candidate_idx").on(t.candidateId),
    index("diagnoses_status_idx").on(t.status),
  ],
);

export const diagnosisSkills = pgTable(
  "diagnosis_skills",
  {
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.diagnosisId, t.skillId] })],
);

export const diagnosisCertifications = pgTable(
  "diagnosis_certifications",
  {
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id, { onDelete: "cascade" }),
    certificationId: integer("certification_id")
      .notNull()
      .references(() => certifications.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.diagnosisId, t.certificationId] })],
);

/** One row per evaluated occupation, including the score breakdown shown to admins. */
export const diagnosisOccupationMatches = pgTable(
  "diagnosis_occupation_matches",
  {
    id: serial("id").primaryKey(),
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id, { onDelete: "cascade" }),
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id),
    isCurrent: boolean("is_current").notNull().default(false),
    matchScore: integer("match_score").notNull(),
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull(),
    salaryLow: integer("salary_low"),
    salaryMedian: integer("salary_median"),
    salaryHigh: integer("salary_high"),
    benchmarkId: integer("benchmark_id").references(() => salaryMarketBenchmarks.id),
    transitionRuleId: integer("transition_rule_id").references(
      () => careerTransitionRules.id,
    ),
    rankOrder: integer("rank_order").notNull(),
  },
  (t) => [
    uniqueIndex("diagnosis_matches_unique").on(t.diagnosisId, t.occupationId),
    index("diagnosis_matches_diagnosis_idx").on(t.diagnosisId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Conversion                                                                 */
/* -------------------------------------------------------------------------- */

export const interviewBookings = pgTable(
  "interview_bookings",
  {
    id: serial("id").primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    slotLabel: text("slot_label"),
    status: bookingStatusEnum("status").notNull().default("booked"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    staffUserId: uuid("staff_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("interview_bookings_candidate_idx").on(t.candidateId)],
);

/* -------------------------------------------------------------------------- */
/* Agent routing                                                              */
/* -------------------------------------------------------------------------- */

export const agentSpecialties = pgTable(
  "agent_specialties",
  {
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id, { onDelete: "cascade" }),
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id, { onDelete: "cascade" }),
    /** 1-5, how strong the agency is in this occupation. */
    strength: integer("strength").notNull().default(3),
  },
  (t) => [primaryKey({ columns: [t.agentCompanyId, t.occupationId] })],
);

export const agentRegions = pgTable(
  "agent_regions",
  {
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id, { onDelete: "cascade" }),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.agentCompanyId, t.regionId] })],
);

export const agentSalaryBands = pgTable("agent_salary_bands", {
  agentCompanyId: integer("agent_company_id")
    .primaryKey()
    .references(() => agentCompanies.id, { onDelete: "cascade" }),
  minSalaryYen: integer("min_salary_yen").notNull().default(0),
  maxSalaryYen: integer("max_salary_yen").notNull().default(30_000_000),
});

/** Fee schedule per agency; drives estimated & confirmed revenue. */
export const agentFeeRules = pgTable(
  "agent_fee_rules",
  {
    id: serial("id").primaryKey(),
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id, { onDelete: "cascade" }),
    eventType: revenueEventTypeEnum("event_type").notNull(),
    amountYen: integer("amount_yen").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("agent_fee_rules_company_idx").on(t.agentCompanyId, t.eventType)],
);

export const agentRecommendations = pgTable(
  "agent_recommendations",
  {
    id: serial("id").primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    rankOrder: integer("rank_order").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_recommendations_unique").on(t.candidateId, t.agentCompanyId)],
);

/** Explicit third-party disclosure consent, one row per agency. */
export const consents = pgTable(
  "consents",
  {
    id: serial("id").primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    contentVersion: text("content_version").notNull(),
    consentText: text("consent_text").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("consents_candidate_idx").on(t.candidateId, t.agentCompanyId)],
);

export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id, { onDelete: "cascade" }),
    consentId: integer("consent_id")
      .notNull()
      .references(() => consents.id),
    status: referralStatusEnum("status").notNull().default("pending"),
    referredAt: timestamp("referred_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    interviewScheduledAt: timestamp("interview_scheduled_at", { withTimezone: true }),
    interviewCompletedAt: timestamp("interview_completed_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    offerAt: timestamp("offer_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    offerCompany: text("offer_company"),
    offerJobTitle: text("offer_job_title"),
    offerSalaryYen: integer("offer_salary_yen"),
    offerDate: date("offer_date"),
    joinedDate: date("joined_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("referrals_candidate_agent_unique").on(t.candidateId, t.agentCompanyId),
    index("referrals_agent_idx").on(t.agentCompanyId),
    index("referrals_status_idx").on(t.status),
  ],
);

export const revenueEvents = pgTable(
  "revenue_events",
  {
    id: serial("id").primaryKey(),
    referralId: integer("referral_id")
      .notNull()
      .references(() => referrals.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    agentCompanyId: integer("agent_company_id")
      .notNull()
      .references(() => agentCompanies.id),
    eventType: revenueEventTypeEnum("event_type").notNull(),
    amountYen: integer("amount_yen").notNull(),
    status: revenueStatusEnum("status").notNull().default("estimated"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    feeRuleId: integer("fee_rule_id").references(() => agentFeeRules.id),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("revenue_events_unique").on(t.referralId, t.eventType),
    index("revenue_events_occurred_idx").on(t.occurredAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Sales incentives & costs                                                   */
/* -------------------------------------------------------------------------- */

export const incentiveRules = pgTable(
  "incentive_rules",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    eventType: incentiveEventTypeEnum("event_type").notNull(),
    amountYen: integer("amount_yen").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    active: boolean("active").notNull().default(true),
    /** Optional extra predicates, e.g. { "minMatchRank": "B" }. */
    conditions: jsonb("conditions").$type<Record<string, unknown>>(),
    priority: integer("priority").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("incentive_rules_event_idx").on(t.eventType, t.active)],
);

export const incentiveLedger = pgTable(
  "incentive_ledger",
  {
    id: serial("id").primaryKey(),
    salesUserId: uuid("sales_user_id")
      .notNull()
      .references(() => users.id),
    candidateId: uuid("candidate_id").references(() => candidates.id, {
      onDelete: "cascade",
    }),
    shiftId: integer("shift_id").references(() => shifts.id),
    eventType: incentiveEventTypeEnum("event_type").notNull(),
    amountYen: integer("amount_yen").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => incentiveRules.id),
    status: incentiveStatusEnum("status").notNull().default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Hard guarantee against double-crediting the same funnel event. */
    uniqueIndex("incentive_ledger_dedupe").on(t.candidateId, t.eventType),
    index("incentive_ledger_sales_user_idx").on(t.salesUserId, t.occurredAt),
    index("incentive_ledger_shift_idx").on(t.shiftId),
  ],
);

/** Non-incentive acquisition spend (venue fees, printing, transport...). */
export const acquisitionCosts = pgTable(
  "acquisition_costs",
  {
    id: serial("id").primaryKey(),
    incurredOn: date("incurred_on").notNull(),
    category: text("category").notNull(),
    amountYen: integer("amount_yen").notNull(),
    locationId: integer("location_id").references(() => locations.id),
    shiftId: integer("shift_id").references(() => shifts.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("acquisition_costs_date_idx").on(t.incurredOn)],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ one, many }) => ({
  agentCompany: one(agentCompanies, {
    fields: [users.agentCompanyId],
    references: [agentCompanies.id],
  }),
  shifts: many(shifts),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  salesUser: one(users, { fields: [shifts.salesUserId], references: [users.id] }),
  location: one(locations, { fields: [shifts.locationId], references: [locations.id] }),
  qrCodes: many(qrCodes),
}));

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  contact: one(candidateContacts, {
    fields: [candidates.id],
    references: [candidateContacts.candidateId],
  }),
  salesUser: one(users, { fields: [candidates.salesUserId], references: [users.id] }),
  shift: one(shifts, { fields: [candidates.shiftId], references: [shifts.id] }),
  location: one(locations, {
    fields: [candidates.locationId],
    references: [locations.id],
  }),
  diagnoses: many(diagnoses),
  events: many(candidateEvents),
  referrals: many(referrals),
  bookings: many(interviewBookings),
}));

export const diagnosesRelations = relations(diagnoses, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [diagnoses.candidateId],
    references: [candidates.id],
  }),
  currentOccupation: one(occupations, {
    fields: [diagnoses.currentOccupationId],
    references: [occupations.id],
  }),
  matches: many(diagnosisOccupationMatches),
}));

export const referralsRelations = relations(referrals, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [referrals.candidateId],
    references: [candidates.id],
  }),
  agentCompany: one(agentCompanies, {
    fields: [referrals.agentCompanyId],
    references: [agentCompanies.id],
  }),
  revenueEvents: many(revenueEvents),
}));
