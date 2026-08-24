CREATE TYPE "public"."candidate_event_type" AS ENUM('qr_scanned', 'diagnosis_started', 'diagnosis_completed', 'lead_registered', 'interview_booked', 'interview_completed', 'candidate_qualified', 'agent_recommended', 'consent_given', 'agent_referred', 'agent_accepted', 'agent_declined', 'agent_interview_completed', 'applied', 'offer_received', 'joined', 'lost');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('anonymous', 'diagnosed', 'lead', 'interview_booked', 'interview_completed', 'qualified', 'referred', 'joined', 'lost');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('high_school', 'vocational', 'associate', 'bachelor', 'master', 'other');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'contract', 'dispatch', 'part_time', 'freelance', 'unemployed');--> statement-breakpoint
CREATE TYPE "public"."experience_band" AS ENUM('0-2', '3-5', '6-9', '10-14', '15+');--> statement-breakpoint
CREATE TYPE "public"."incentive_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('booked', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."monetizable_event" AS ENUM('diagnosis_completed', 'lead_registered', 'interview_booked', 'interview_completed', 'candidate_qualified', 'agent_referred', 'agent_accepted', 'agent_interview_completed', 'offer', 'joined');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('referred', 'accepted', 'declined', 'contacted', 'interview_scheduled', 'interview_completed', 'application', 'offer', 'joined', 'lost');--> statement-breakpoint
CREATE TYPE "public"."revenue_status" AS ENUM('estimated', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'sales', 'agent');--> statement-breakpoint
CREATE TYPE "public"."value_rank" AS ENUM('S', 'A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."venue_type" AS ENUM('shopping_mall', 'station', 'shopping_street', 'residential_area', 'park', 'supermarket', 'home_center', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."weather" AS ENUM('sunny', 'cloudy', 'rainy', 'snowy', 'windy');--> statement-breakpoint
CREATE TABLE "agent_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_email" varchar(255),
	"specialty_occupation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coverage_region_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_salary_focus" integer,
	"max_salary_focus" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_company_id" uuid NOT NULL,
	"event_type" "monetizable_event" NOT NULL,
	"amount" integer NOT NULL,
	"percent_of_offer_salary" numeric(5, 2),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rank_position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" varchar(300),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" "user_role",
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_attributions" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"qr_code_id" uuid,
	"sales_user_id" uuid,
	"shift_id" uuid,
	"location_id" uuid,
	"source" varchar(30) DEFAULT 'qr' NOT NULL,
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"overridden_by_user_id" uuid,
	"override_reason" text
);
--> statement-breakpoint
CREATE TABLE "candidate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"event_type" "candidate_event_type" NOT NULL,
	"user_id" uuid,
	"shift_id" uuid,
	"location_id" uuid,
	"agent_company_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_token" varchar(40) NOT NULL,
	"status" "candidate_status" DEFAULT 'anonymous' NOT NULL,
	"full_name" varchar(120),
	"email" varchar(255),
	"phone" varchar(40),
	"birth_year" integer,
	"prefecture" varchar(40),
	"desired_prefectures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"age_band" varchar(20),
	"job_change_timing" varchar(40),
	"qualified" boolean DEFAULT false NOT NULL,
	"qualified_at" timestamp with time zone,
	"lead_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_transition_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_occupation_id" uuid NOT NULL,
	"target_occupation_id" uuid NOT NULL,
	"base_transition_score" integer DEFAULT 50 NOT NULL,
	"required_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_certification_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_certification_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minimum_experience_years" integer DEFAULT 0 NOT NULL,
	"requires_relocation" boolean DEFAULT false NOT NULL,
	"requires_business_trip" boolean DEFAULT false NOT NULL,
	"requires_night_shift" boolean DEFAULT false NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	CONSTRAINT "certifications_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" uuid NOT NULL,
	"consent_type" varchar(60) DEFAULT 'third_party_provision' NOT NULL,
	"consent_text" text NOT NULL,
	"consent_version" varchar(20) DEFAULT '1.0' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"input" jsonb NOT NULL,
	"current_occupation_id" uuid,
	"region_id" uuid,
	"experience_band" "experience_band",
	"current_salary" integer,
	"current_market_median" integer,
	"estimated_salary_low" integer,
	"estimated_salary_high" integer,
	"improvement_low" integer,
	"improvement_high" integer,
	"value_rank" "value_rank",
	"best_match_score" integer,
	"result" jsonb,
	"config_snapshot" jsonb,
	"engine_version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diagnosis_occupation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"occupation_id" uuid NOT NULL,
	"is_current_occupation" boolean DEFAULT false NOT NULL,
	"match_score" integer NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"salary_low" integer,
	"salary_median" integer,
	"salary_high" integer,
	"rank_position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"shift_id" uuid,
	"event_type" "monetizable_event" NOT NULL,
	"amount" integer NOT NULL,
	"rule_id" uuid,
	"status" "incentive_status" DEFAULT 'pending' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"rejected_reason" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "incentive_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "monetizable_event" NOT NULL,
	"amount" integer NOT NULL,
	"description" varchar(200),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "interview_status" DEFAULT 'booked' NOT NULL,
	"mode" varchar(30) DEFAULT 'online' NOT NULL,
	"assigned_user_id" uuid,
	"notes" text,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prefecture" varchar(40) NOT NULL,
	"city" varchar(80) NOT NULL,
	"district" varchar(80),
	"venue_name" varchar(160) NOT NULL,
	"venue_type" "venue_type" NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"station_name" varchar(120),
	"region_id" uuid,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupation_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occupation_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"importance_weight" numeric(4, 3) DEFAULT '0.500' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "occupations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(40) NOT NULL,
	"shift_id" uuid NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" uuid NOT NULL,
	"consent_id" uuid NOT NULL,
	"status" "referral_status" DEFAULT 'referred' NOT NULL,
	"referred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"contacted_at" timestamp with time zone,
	"interview_scheduled_at" timestamp with time zone,
	"interview_completed_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"offer_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"offer_company_name" varchar(200),
	"offer_job_title" varchar(200),
	"offer_occupation_id" uuid,
	"offer_salary" integer,
	"offer_date" date,
	"joined_date" date,
	"lost_reason" varchar(200),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"prefecture" varchar(40) NOT NULL,
	"is_national_fallback" boolean DEFAULT false NOT NULL,
	CONSTRAINT "regions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" uuid NOT NULL,
	"referral_id" uuid,
	"fee_rule_id" uuid,
	"event_type" "monetizable_event" NOT NULL,
	"amount" integer NOT NULL,
	"status" "revenue_status" DEFAULT 'estimated' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "salary_market_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occupation_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"experience_band" "experience_band" NOT NULL,
	"education_level" "education_level",
	"salary_low" integer NOT NULL,
	"salary_median" integer NOT NULL,
	"salary_high" integer NOT NULL,
	"source" varchar(60) DEFAULT 'manual' NOT NULL,
	"source_date" date NOT NULL,
	"confidence_level" "confidence_level" DEFAULT 'medium' NOT NULL,
	"sample_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_code_id" uuid NOT NULL,
	"candidate_id" uuid,
	"visitor_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"planned_end_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"weather" "weather",
	"venue_type" "venue_type" NOT NULL,
	"memo" text,
	"status" "shift_status" DEFAULT 'active' NOT NULL,
	"approach_count" integer DEFAULT 0 NOT NULL,
	"stopped_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	CONSTRAINT "skills_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"role" "user_role" NOT NULL,
	"agent_company_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_fee_rules" ADD CONSTRAINT "agent_fee_rules_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_attributions" ADD CONSTRAINT "candidate_attributions_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_attributions" ADD CONSTRAINT "candidate_attributions_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_attributions" ADD CONSTRAINT "candidate_attributions_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_attributions" ADD CONSTRAINT "candidate_attributions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_attributions" ADD CONSTRAINT "candidate_attributions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_attributions" ADD CONSTRAINT "candidate_attributions_overridden_by_user_id_users_id_fk" FOREIGN KEY ("overridden_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_transition_rules" ADD CONSTRAINT "career_transition_rules_source_occupation_id_occupations_id_fk" FOREIGN KEY ("source_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_transition_rules" ADD CONSTRAINT "career_transition_rules_target_occupation_id_occupations_id_fk" FOREIGN KEY ("target_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_current_occupation_id_occupations_id_fk" FOREIGN KEY ("current_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_occupation_matches" ADD CONSTRAINT "diagnosis_occupation_matches_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_occupation_matches" ADD CONSTRAINT "diagnosis_occupation_matches_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_rule_id_incentive_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."incentive_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_skills" ADD CONSTRAINT "occupation_skills_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_skills" ADD CONSTRAINT "occupation_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_offer_occupation_id_occupations_id_fk" FOREIGN KEY ("offer_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_fee_rule_id_agent_fee_rules_id_fk" FOREIGN KEY ("fee_rule_id") REFERENCES "public"."agent_fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_market_benchmarks" ADD CONSTRAINT "salary_market_benchmarks_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_market_benchmarks" ADD CONSTRAINT "salary_market_benchmarks_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_fee_rules_agent_idx" ON "agent_fee_rules" USING btree ("agent_company_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_reco_unique" ON "agent_recommendations" USING btree ("candidate_id","agent_company_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "candidate_attr_sales_idx" ON "candidate_attributions" USING btree ("sales_user_id");--> statement-breakpoint
CREATE INDEX "candidate_attr_shift_idx" ON "candidate_attributions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "candidate_events_candidate_idx" ON "candidate_events" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_events_type_idx" ON "candidate_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "candidate_events_created_idx" ON "candidate_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "candidate_events_shift_idx" ON "candidate_events" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_public_token_unique" ON "candidates" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "candidates_status_idx" ON "candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "candidates_created_idx" ON "candidates" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "career_transition_rules_unique" ON "career_transition_rules" USING btree ("source_occupation_id","target_occupation_id");--> statement-breakpoint
CREATE INDEX "career_transition_rules_source_idx" ON "career_transition_rules" USING btree ("source_occupation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consents_unique" ON "consents" USING btree ("candidate_id","agent_company_id","consent_type");--> statement-breakpoint
CREATE INDEX "consents_candidate_idx" ON "consents" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "diagnoses_candidate_idx" ON "diagnoses" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "diagnoses_completed_idx" ON "diagnoses" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "diagnosis_matches_diagnosis_idx" ON "diagnosis_occupation_matches" USING btree ("diagnosis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incentive_ledger_unique" ON "incentive_ledger" USING btree ("candidate_id","event_type");--> statement-breakpoint
CREATE INDEX "incentive_ledger_sales_idx" ON "incentive_ledger" USING btree ("sales_user_id");--> statement-breakpoint
CREATE INDEX "incentive_ledger_occurred_idx" ON "incentive_ledger" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "incentive_rules_event_idx" ON "incentive_rules" USING btree ("event_type","active");--> statement-breakpoint
CREATE INDEX "interviews_candidate_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_scheduled_idx" ON "interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "locations_active_idx" ON "locations" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "occupation_skills_unique" ON "occupation_skills" USING btree ("occupation_id","skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_token_unique" ON "qr_codes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "qr_codes_shift_idx" ON "qr_codes" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_unique" ON "referrals" USING btree ("candidate_id","agent_company_id");--> statement-breakpoint
CREATE INDEX "referrals_agent_idx" ON "referrals" USING btree ("agent_company_id");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_events_unique" ON "revenue_events" USING btree ("candidate_id","agent_company_id","event_type");--> statement-breakpoint
CREATE INDEX "revenue_events_occurred_idx" ON "revenue_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_benchmark_unique" ON "salary_market_benchmarks" USING btree ("occupation_id","region_id","experience_band","education_level");--> statement-breakpoint
CREATE INDEX "salary_benchmark_lookup_idx" ON "salary_market_benchmarks" USING btree ("occupation_id","region_id");--> statement-breakpoint
CREATE INDEX "scan_events_qr_idx" ON "scan_events" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX "scan_events_created_idx" ON "scan_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shifts_sales_user_idx" ON "shifts" USING btree ("sales_user_id");--> statement-breakpoint
CREATE INDEX "shifts_start_idx" ON "shifts" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "shifts_location_idx" ON "shifts" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");