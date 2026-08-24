CREATE TABLE "occupation_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occupation_id" uuid NOT NULL,
	"certification_id" uuid NOT NULL,
	"importance_weight" numeric(4, 3) DEFAULT '0.500' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "occupation_certifications" ADD CONSTRAINT "occupation_certifications_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_certifications" ADD CONSTRAINT "occupation_certifications_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "occupation_certifications_unique" ON "occupation_certifications" USING btree ("occupation_id","certification_id");