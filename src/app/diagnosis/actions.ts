'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { diagnosisAnswersSchema, leadRegistrationSchema } from '@/domain/diagnosis/input-schema';
import {
  beginDiagnosis,
  bookInterview,
  getCandidateByPublicToken,
  registerLead,
} from '@/server/services/candidates';
import { completeDiagnosis } from '@/server/services/diagnosis';
import { buildRecommendations, consentAndRefer } from '@/server/services/referrals';
import { getCandidateIdFromCookie, setCandidateCookie } from '@/server/candidate-cookie';

export async function beginDiagnosisAction(): Promise<void> {
  const existing = await getCandidateIdFromCookie();
  const candidateId = await beginDiagnosis(existing);
  await setCandidateCookie(candidateId);
  redirect('/diagnosis/start');
}

export interface SubmitDiagnosisState {
  error?: string;
}

export async function submitDiagnosisAction(
  _prev: SubmitDiagnosisState,
  formData: FormData,
): Promise<SubmitDiagnosisState> {
  const raw = formData.get('answers');
  if (typeof raw !== 'string') return { error: '回答の送信に失敗しました。' };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: '回答の形式が正しくありません。' };
  }

  const parsed = diagnosisAnswersSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };
  }

  const existing = await getCandidateIdFromCookie();
  const candidateId = await beginDiagnosis(existing);
  await setCandidateCookie(candidateId);

  await completeDiagnosis({ candidateId, answers: parsed.data });

  const publicToken = await getCandidatePublicToken(candidateId);
  redirect(`/diagnosis/result/${publicToken}`);
}

async function getCandidatePublicToken(candidateId: string): Promise<string> {
  const { getDb, schema } = await import('@/db/client');
  const { eq } = await import('drizzle-orm');
  const row = await getDb().query.candidates.findFirst({ where: eq(schema.candidates.id, candidateId) });
  if (!row) throw new Error('候補者が見つかりません。');
  return row.publicToken;
}

export interface LeadState {
  error?: string;
}

export async function registerLeadAction(
  publicToken: string,
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const candidate = await getCandidateByPublicToken(publicToken);
  if (!candidate) return { error: '診断結果が見つかりません。' };

  const parsed = leadRegistrationSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    birthYear: formData.get('birthYear') ? Number(formData.get('birthYear')) : undefined,
    privacyAgreed: formData.get('privacyAgreed') === 'on',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };
  }

  await registerLead(candidate.id, parsed.data);
  redirect(`/candidate/${publicToken}?registered=1`);
}

const interviewSchema = z.object({
  scheduledAt: z.string().min(1, '希望日時を選択してください'),
  mode: z.enum(['online', 'phone']),
});

export interface InterviewState {
  error?: string;
}

export async function bookInterviewAction(
  publicToken: string,
  _prev: InterviewState,
  formData: FormData,
): Promise<InterviewState> {
  const candidate = await getCandidateByPublicToken(publicToken);
  if (!candidate) return { error: '候補者が見つかりません。' };
  if (!candidate.leadRegisteredAt) return { error: '先に連絡先の登録が必要です。' };

  const parsed = interviewSchema.safeParse({
    scheduledAt: formData.get('scheduledAt'),
    mode: formData.get('mode'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    return { error: '未来の日時を指定してください。' };
  }

  await bookInterview({ candidateId: candidate.id, scheduledAt, mode: parsed.data.mode });
  await buildRecommendations(candidate.id);
  redirect(`/candidate/${publicToken}?booked=1`);
}

export interface ConsentState {
  error?: string;
}

export async function consentAndReferAction(
  publicToken: string,
  _prev: ConsentState,
  formData: FormData,
): Promise<ConsentState> {
  const candidate = await getCandidateByPublicToken(publicToken);
  if (!candidate) return { error: '候補者が見つかりません。' };
  if (!candidate.leadRegisteredAt) return { error: '先に連絡先の登録が必要です。' };

  const agentCompanyId = formData.get('agentCompanyId');
  if (typeof agentCompanyId !== 'string' || !agentCompanyId) {
    return { error: '送客先のエージェントを選択してください。' };
  }
  if (formData.get('consent') !== 'on') {
    return { error: '第三者提供への同意が必要です。' };
  }

  await consentAndRefer({ candidateId: candidate.id, agentCompanyId });
  redirect(`/candidate/${publicToken}?referred=1`);
}
