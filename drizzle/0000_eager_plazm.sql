CREATE TYPE "public"."attribution_source" AS ENUM('qr', 'manual', 'direct');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."candidate_event_type" AS ENUM('qr_scanned', 'diagnosis_started', 'diagnosis_completed', 'lead_registered', 'interview_booked', 'interview_completed', 'candidate_qualified', 'agent_recommended', 'consent_given', 'agent_referred', 'agent_accepted', 'agent_declined', 'agent_interview_completed', 'applied', 'offer_received', 'joined', 'lost');--> statement-breakpoint
CREATE TYPE "public"."candidate_stage" AS ENUM('anonymous', 'diagnosed', 'lead', 'interview_booked', 'interview_completed', 'qualified', 'referred', 'outcome');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."counter_type" AS ENUM('approach', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."diagnosis_status" AS ENUM('started', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('high_school', 'vocational', 'associate', 'bachelor', 'master', 'doctorate', 'other');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'contract', 'dispatch', 'part_time', 'self_employed', 'other');--> statement-breakpoint
CREATE TYPE "public"."experience_band" AS ENUM('0-2', '3-5', '6-9', '10-14', '15+');--> statement-breakpoint
CREATE TYPE "public"."incentive_event_type" AS ENUM('diagnosis_completed', 'lead_registered', 'interview_booked', 'interview_completed', 'candidate_qualified', 'agent_referred', 'offer', 'joined');--> statement-breakpoint
CREATE TYPE "public"."incentive_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."match_rank" AS ENUM('S', 'A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'accepted', 'declined', 'contacted', 'interview_scheduled', 'interview_completed', 'applied', 'offer', 'joined', 'lost');--> statement-breakpoint
CREATE TYPE "public"."revenue_event_type" AS ENUM('agent_accepted', 'agent_interview_completed', 'offer', 'joined');--> statement-breakpoint
CREATE TYPE "public"."revenue_status" AS ENUM('estimated', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'sales', 'agent');--> statement-breakpoint
CREATE TYPE "public"."venue_type" AS ENUM('shopping_mall', 'station', 'shopping_street', 'residential_area', 'park', 'supermarket', 'home_center', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."weather" AS ENUM('sunny', 'cloudy', 'rainy', 'snowy', 'hot', 'cold');--> statement-breakpoint
CREATE TABLE "acquisition_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"incurred_on" date NOT NULL,
	"category" text NOT NULL,
	"amount_yen" integer NOT NULL,
	"location_id" integer,
	"shift_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_fee_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_company_id" integer NOT NULL,
	"event_type" "revenue_event_type" NOT NULL,
	"amount_yen" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" integer NOT NULL,
	"score" integer NOT NULL,
	"rank_order" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_regions" (
	"agent_company_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	CONSTRAINT "agent_regions_agent_company_id_region_id_pk" PRIMARY KEY("agent_company_id","region_id")
);
--> statement-breakpoint
CREATE TABLE "agent_salary_bands" (
	"agent_company_id" integer PRIMARY KEY NOT NULL,
	"min_salary_yen" integer DEFAULT 0 NOT NULL,
	"max_salary_yen" integer DEFAULT 30000000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_specialties" (
	"agent_company_id" integer NOT NULL,
	"occupation_id" integer NOT NULL,
	"strength" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "agent_specialties_agent_company_id_occupation_id_pk" PRIMARY KEY("agent_company_id","occupation_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_contacts" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"full_name_kana" text,
	"email" text NOT NULL,
	"phone" text,
	"birth_year" integer,
	"preferred_contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"event_type" "candidate_event_type" NOT NULL,
	"user_id" uuid,
	"shift_id" integer,
	"location_id" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_token" text NOT NULL,
	"stage" "candidate_stage" DEFAULT 'anonymous' NOT NULL,
	"qr_code_id" integer,
	"sales_user_id" uuid,
	"shift_id" integer,
	"location_id" integer,
	"attribution_source" "attribution_source" DEFAULT 'direct' NOT NULL,
	"attribution_locked_at" timestamp with time zone,
	"attribution_overridden_by" uuid,
	"attribution_override_reason" text,
	"qualified" boolean DEFAULT false NOT NULL,
	"qualified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_transition_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_occupation_id" integer NOT NULL,
	"target_occupation_id" integer NOT NULL,
	"base_transition_score" integer DEFAULT 50 NOT NULL,
	"required_skill_ids" integer[] DEFAULT '{}' NOT NULL,
	"preferred_skill_ids" integer[] DEFAULT '{}' NOT NULL,
	"required_certification_ids" integer[] DEFAULT '{}' NOT NULL,
	"preferred_certification_ids" integer[] DEFAULT '{}' NOT NULL,
	"minimum_experience_years" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" integer NOT NULL,
	"scope" text NOT NULL,
	"content_version" text NOT NULL,
	"consent_text" text NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "diagnosis_status" DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"answers" jsonb,
	"engine_version" text,
	"config_snapshot" jsonb,
	"current_occupation_id" integer,
	"current_salary_yen" integer,
	"experience_years" integer,
	"experience_band" "experience_band",
	"education_level" "education_level",
	"employment_type" "employment_type",
	"management_years" integer DEFAULT 0 NOT NULL,
	"current_region_id" integer,
	"desired_region_ids" integer[] DEFAULT '{}' NOT NULL,
	"relocation_ok" boolean DEFAULT false NOT NULL,
	"travel_ok" boolean DEFAULT false NOT NULL,
	"night_shift_ok" boolean DEFAULT false NOT NULL,
	"desired_conditions" text[] DEFAULT '{}' NOT NULL,
	"desired_timing" text,
	"current_market_low" integer,
	"current_market_median" integer,
	"current_market_high" integer,
	"estimated_salary_low" integer,
	"estimated_salary_high" integer,
	"uplift_low" integer,
	"uplift_high" integer,
	"best_match_score" integer,
	"match_rank" "match_rank",
	"valued_experiences" jsonb,
	"data_confidence" "confidence_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnosis_certifications" (
	"diagnosis_id" uuid NOT NULL,
	"certification_id" integer NOT NULL,
	CONSTRAINT "diagnosis_certifications_diagnosis_id_certification_id_pk" PRIMARY KEY("diagnosis_id","certification_id")
);
--> statement-breakpoint
CREATE TABLE "diagnosis_occupation_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"occupation_id" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"match_score" integer NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"salary_low" integer,
	"salary_median" integer,
	"salary_high" integer,
	"benchmark_id" integer,
	"transition_rule_id" integer,
	"rank_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnosis_skills" (
	"diagnosis_id" uuid NOT NULL,
	"skill_id" integer NOT NULL,
	CONSTRAINT "diagnosis_skills_diagnosis_id_skill_id_pk" PRIMARY KEY("diagnosis_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "incentive_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"candidate_id" uuid,
	"shift_id" integer,
	"event_type" "incentive_event_type" NOT NULL,
	"amount_yen" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rule_id" integer NOT NULL,
	"status" "incentive_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_type" "incentive_event_type" NOT NULL,
	"amount_yen" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"active" boolean DEFAULT true NOT NULL,
	"conditions" jsonb,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"slot_label" text,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"completed_at" timestamp with time zone,
	"staff_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer,
	"prefecture" text NOT NULL,
	"city" text NOT NULL,
	"district" text,
	"venue_name" text NOT NULL,
	"venue_type" "venue_type" NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"station_name" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupation_certifications" (
	"occupation_id" integer NOT NULL,
	"certification_id" integer NOT NULL,
	"importance_weight" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	CONSTRAINT "occupation_certifications_occupation_id_certification_id_pk" PRIMARY KEY("occupation_id","certification_id")
);
--> statement-breakpoint
CREATE TABLE "occupation_skills" (
	"occupation_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"importance_weight" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	CONSTRAINT "occupation_skills_occupation_id_skill_id_pk" PRIMARY KEY("occupation_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"requires_travel" boolean DEFAULT false NOT NULL,
	"requires_night_shift" boolean DEFAULT false NOT NULL,
	"requires_relocation" boolean DEFAULT false NOT NULL,
	"min_education_level" "education_level",
	"management_relevant" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"shift_id" integer NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"location_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" integer NOT NULL,
	"consent_id" integer NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
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
	"lost_reason" text,
	"offer_company" text,
	"offer_job_title" text,
	"offer_salary_yen" integer,
	"offer_date" date,
	"joined_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"prefecture" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_id" integer NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agent_company_id" integer NOT NULL,
	"event_type" "revenue_event_type" NOT NULL,
	"amount_yen" integer NOT NULL,
	"status" "revenue_status" DEFAULT 'estimated' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"fee_rule_id" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "salary_market_benchmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"occupation_id" integer NOT NULL,
	"region_id" integer,
	"experience_band" "experience_band" NOT NULL,
	"education_level" "education_level",
	"salary_low" integer NOT NULL,
	"salary_median" integer NOT NULL,
	"salary_high" integer NOT NULL,
	"source" text NOT NULL,
	"source_date" date NOT NULL,
	"confidence_level" "confidence_level" DEFAULT 'medium' NOT NULL,
	"sample_size" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"qr_code_id" integer NOT NULL,
	"shift_id" integer NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"location_id" integer NOT NULL,
	"candidate_id" uuid,
	"is_attributed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_counter_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"counter_type" "counter_type" NOT NULL,
	"delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_user_id" uuid NOT NULL,
	"location_id" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"planned_end_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"weather" "weather",
	"venue_type" "venue_type" NOT NULL,
	"memo" text,
	"status" "shift_status" DEFAULT 'active' NOT NULL,
	"approach_count" integer DEFAULT 0 NOT NULL,
	"stopped_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"agent_company_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acquisition_costs" ADD CONSTRAINT "acquisition_costs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_costs" ADD CONSTRAINT "acquisition_costs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_fee_rules" ADD CONSTRAINT "agent_fee_rules_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_regions" ADD CONSTRAINT "agent_regions_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_regions" ADD CONSTRAINT "agent_regions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_salary_bands" ADD CONSTRAINT "agent_salary_bands_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_specialties" ADD CONSTRAINT "agent_specialties_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_specialties" ADD CONSTRAINT "agent_specialties_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_contacts" ADD CONSTRAINT "candidate_contacts_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_attribution_overridden_by_users_id_fk" FOREIGN KEY ("attribution_overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_transition_rules" ADD CONSTRAINT "career_transition_rules_source_occupation_id_occupations_id_fk" FOREIGN KEY ("source_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_transition_rules" ADD CONSTRAINT "career_transition_rules_target_occupation_id_occupations_id_fk" FOREIGN KEY ("target_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_current_occupation_id_occupations_id_fk" FOREIGN KEY ("current_occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_current_region_id_regions_id_fk" FOREIGN KEY ("current_region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_certifications" ADD CONSTRAINT "diagnosis_certifications_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_certifications" ADD CONSTRAINT "diagnosis_certifications_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_occupation_matches" ADD CONSTRAINT "diagnosis_occupation_matches_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_occupation_matches" ADD CONSTRAINT "diagnosis_occupation_matches_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_occupation_matches" ADD CONSTRAINT "diagnosis_occupation_matches_benchmark_id_salary_market_benchmarks_id_fk" FOREIGN KEY ("benchmark_id") REFERENCES "public"."salary_market_benchmarks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_occupation_matches" ADD CONSTRAINT "diagnosis_occupation_matches_transition_rule_id_career_transition_rules_id_fk" FOREIGN KEY ("transition_rule_id") REFERENCES "public"."career_transition_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_skills" ADD CONSTRAINT "diagnosis_skills_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_skills" ADD CONSTRAINT "diagnosis_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_rule_id_incentive_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."incentive_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_ledger" ADD CONSTRAINT "incentive_ledger_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_bookings" ADD CONSTRAINT "interview_bookings_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_bookings" ADD CONSTRAINT "interview_bookings_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_certifications" ADD CONSTRAINT "occupation_certifications_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_certifications" ADD CONSTRAINT "occupation_certifications_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_skills" ADD CONSTRAINT "occupation_skills_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_skills" ADD CONSTRAINT "occupation_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_fee_rule_id_agent_fee_rules_id_fk" FOREIGN KEY ("fee_rule_id") REFERENCES "public"."agent_fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_market_benchmarks" ADD CONSTRAINT "salary_market_benchmarks_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_market_benchmarks" ADD CONSTRAINT "salary_market_benchmarks_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_counter_events" ADD CONSTRAINT "shift_counter_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_counter_events" ADD CONSTRAINT "shift_counter_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_sales_user_id_users_id_fk" FOREIGN KEY ("sales_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_agent_company_id_agent_companies_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."agent_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acquisition_costs_date_idx" ON "acquisition_costs" USING btree ("incurred_on");--> statement-breakpoint
CREATE INDEX "agent_fee_rules_company_idx" ON "agent_fee_rules" USING btree ("agent_company_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_recommendations_unique" ON "agent_recommendations" USING btree ("candidate_id","agent_company_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "candidate_events_candidate_idx" ON "candidate_events" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_events_type_created_idx" ON "candidate_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "candidate_events_shift_idx" ON "candidate_events" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_public_token_unique" ON "candidates" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "candidates_sales_user_idx" ON "candidates" USING btree ("sales_user_id");--> statement-breakpoint
CREATE INDEX "candidates_shift_idx" ON "candidates" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "candidates_created_idx" ON "candidates" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "career_transition_rules_pair_unique" ON "career_transition_rules" USING btree ("source_occupation_id","target_occupation_id");--> statement-breakpoint
CREATE INDEX "career_transition_rules_source_idx" ON "career_transition_rules" USING btree ("source_occupation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certifications_code_unique" ON "certifications" USING btree ("code");--> statement-breakpoint
CREATE INDEX "consents_candidate_idx" ON "consents" USING btree ("candidate_id","agent_company_id");--> statement-breakpoint
CREATE INDEX "diagnoses_candidate_idx" ON "diagnoses" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "diagnoses_status_idx" ON "diagnoses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnosis_matches_unique" ON "diagnosis_occupation_matches" USING btree ("diagnosis_id","occupation_id");--> statement-breakpoint
CREATE INDEX "diagnosis_matches_diagnosis_idx" ON "diagnosis_occupation_matches" USING btree ("diagnosis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incentive_ledger_dedupe" ON "incentive_ledger" USING btree ("candidate_id","event_type");--> statement-breakpoint
CREATE INDEX "incentive_ledger_sales_user_idx" ON "incentive_ledger" USING btree ("sales_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "incentive_ledger_shift_idx" ON "incentive_ledger" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "incentive_rules_event_idx" ON "incentive_rules" USING btree ("event_type","active");--> statement-breakpoint
CREATE INDEX "interview_bookings_candidate_idx" ON "interview_bookings" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "locations_active_idx" ON "locations" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "occupations_code_unique" ON "occupations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_token_unique" ON "qr_codes" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_candidate_agent_unique" ON "referrals" USING btree ("candidate_id","agent_company_id");--> statement-breakpoint
CREATE INDEX "referrals_agent_idx" ON "referrals" USING btree ("agent_company_id");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_unique" ON "regions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_events_unique" ON "revenue_events" USING btree ("referral_id","event_type");--> statement-breakpoint
CREATE INDEX "revenue_events_occurred_idx" ON "revenue_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "benchmarks_lookup_idx" ON "salary_market_benchmarks" USING btree ("occupation_id","region_id","experience_band");--> statement-breakpoint
CREATE INDEX "scan_events_qr_idx" ON "scan_events" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX "scan_events_shift_idx" ON "scan_events" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "scan_events_created_idx" ON "scan_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shift_counter_events_shift_idx" ON "shift_counter_events" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shifts_sales_user_idx" ON "shifts" USING btree ("sales_user_id");--> statement-breakpoint
CREATE INDEX "shifts_location_idx" ON "shifts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "shifts_start_idx" ON "shifts" USING btree ("start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_code_unique" ON "skills" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");