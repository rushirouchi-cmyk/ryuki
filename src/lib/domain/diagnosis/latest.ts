import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { diagnoses } from "@/lib/db/schema";

/**
 * Subquery yielding one row per candidate: their most recently completed
 * diagnosis.
 *
 * A candidate may legitimately retake the diagnosis — their answers change, and
 * keeping the history matters for improving the model. Joining `diagnoses`
 * directly would then duplicate the candidate in every list and inflate every
 * `count()` that joins through it, so all read paths go through this.
 */
export function latestDiagnosisFor(db: Database) {
  return db
    .selectDistinctOn([diagnoses.candidateId])
    .from(diagnoses)
    .where(eq(diagnoses.status, "completed"))
    .orderBy(diagnoses.candidateId, desc(diagnoses.completedAt))
    .as("latest_diagnosis");
}

export type LatestDiagnosis = ReturnType<typeof latestDiagnosisFor>;
