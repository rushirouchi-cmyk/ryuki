import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentCompanies, referrals } from "@/lib/db/schema";
import { getConsentConfig } from "@/lib/config/store";
import {
  buildRecommendations,
  listRecommendations,
} from "@/lib/domain/agents/service";
import { loadCandidate, loadContact, loadLatestDiagnosis } from "../data";
import { AgentChoiceForm } from "./form";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { db, candidate } = await loadCandidate(token);

  const contact = await loadContact(candidate.id);
  if (!contact) redirect(`/diagnosis/${token}/register`);

  const result = await loadLatestDiagnosis(candidate.id);
  if (!result) redirect(`/diagnosis/${token}`);

  const existingReferrals = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.candidateId, candidate.id));
  if (existingReferrals.length > 0) redirect(`/diagnosis/${token}/done`);

  let recommendations = await listRecommendations(db, candidate.id);
  if (recommendations.length === 0) {
    recommendations = await buildRecommendations(db, candidate.id);
  }

  const database = await getDb();
  const companies = await database
    .select({
      id: agentCompanies.id,
      name: agentCompanies.name,
      notes: agentCompanies.notes,
    })
    .from(agentCompanies);
  const notesById = new Map(companies.map((row) => [row.id, row.notes]));

  const consent = await getConsentConfig(db);

  return (
    <AgentChoiceForm
      token={token}
      consentText={consent.text}
      recommendations={recommendations.map((recommendation) => ({
        ...recommendation,
        notes: notesById.get(recommendation.agentCompanyId) ?? null,
      }))}
    />
  );
}
