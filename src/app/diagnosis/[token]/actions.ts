"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  bookInterview,
  completeDiagnosis,
  findCandidateByToken,
  registerLead,
  startDiagnosis,
} from "@/lib/domain/candidates/service";
import { buildRecommendations, referCandidate } from "@/lib/domain/agents/service";
import { diagnosisAnswersSchema } from "@/lib/domain/diagnosis/questionnaire";

export interface ActionState {
  error?: string;
}

async function requireCandidate(token: string) {
  const db = await getDb();
  const candidate = await findCandidateByToken(db, token);
  if (!candidate) throw new Error("候補者が見つかりません");
  return { db, candidate };
}

export async function startDiagnosisAction(token: string): Promise<never> {
  const { db, candidate } = await requireCandidate(token);
  await startDiagnosis(db, candidate.id);
  redirect(`/diagnosis/${token}/questions`);
}

export async function submitDiagnosisAction(
  token: string,
  rawAnswers: unknown,
): Promise<ActionState> {
  const parsed = diagnosisAnswersSchema.safeParse(rawAnswers);
  if (!parsed.success) {
    return { error: "回答内容に不足があります。もう一度お試しください。" };
  }

  const { db, candidate } = await requireCandidate(token);
  const { diagnosisId } = await startDiagnosis(db, candidate.id);
  await completeDiagnosis(db, candidate.id, diagnosisId, parsed.data);
  revalidatePath(`/diagnosis/${token}/result`);
  return {};
}

const leadSchema = z.object({
  fullName: z.string().trim().min(1, "お名前を入力してください").max(60),
  fullNameKana: z.string().trim().max(60).optional(),
  email: z.email("メールアドレスの形式が正しくありません"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-() ]{10,20}$/, "電話番号の形式が正しくありません")
    .optional()
    .or(z.literal("")),
  birthYear: z.coerce.number().int().min(1940).max(2012).optional(),
  preferredContact: z.enum(["email", "phone"]).optional(),
});

export async function registerLeadAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = leadSchema.safeParse({
    fullName: formData.get("fullName"),
    fullNameKana: formData.get("fullNameKana") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    birthYear: formData.get("birthYear") || undefined,
    preferredContact: formData.get("preferredContact") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" };
  }

  const { db, candidate } = await requireCandidate(token);
  await registerLead(db, candidate.id, {
    fullName: parsed.data.fullName,
    fullNameKana: parsed.data.fullNameKana ?? null,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    birthYear: parsed.data.birthYear ?? null,
    preferredContact: parsed.data.preferredContact ?? null,
  });

  redirect(`/diagnosis/${token}/booking`);
}

const bookingSchema = z.object({
  scheduledAt: z.string().min(1, "希望日時を選択してください"),
});

export async function bookInterviewAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = bookingSchema.safeParse({ scheduledAt: formData.get("scheduledAt") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" };
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "希望日時を選択してください" };
  }

  const { db, candidate } = await requireCandidate(token);
  await bookInterview(
    db,
    candidate.id,
    scheduledAt,
    scheduledAt.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  await buildRecommendations(db, candidate.id);

  redirect(`/diagnosis/${token}/agents`);
}

export async function referAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const agentCompanyIds = formData
    .getAll("agentCompanyId")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (agentCompanyIds.length === 0) {
    return { error: "送客先のエージェントを1社以上選択してください" };
  }
  if (formData.get("consent") !== "on") {
    return { error: "第三者提供への同意が必要です" };
  }

  const { db, candidate } = await requireCandidate(token);
  await referCandidate(db, candidate.id, agentCompanyIds);

  redirect(`/diagnosis/${token}/done`);
}
