'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertCan } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import { toJson } from '@/lib/json';
import { parseCaResponse } from '@/lib/agents/ca-response';
import { refreshCandidateMatches, structureCandidate } from '@/lib/agents/matching';
import { researchForCandidate } from '@/lib/agents/market-research';
import { suggestRejectionTag } from '@/lib/agents/rejection-tagging';
import { CANDIDATE_PHASES, REJECTION_TAGS } from '@/lib/domain/enums';

/**
 * 候補者関連の Server Actions。
 *
 * §51 の原則に従い、AI が確定してよい情報 (タグ・スコア・推奨) と
 * 人の確認が必要な情報 (フェーズ変更・辞退・年収希望・推薦) を分けている。
 */

const actionSchema = z.object({
  candidateId: z.string().min(1),
  actionType: z.string().min(1),
  memo: z.string().max(2000).optional(),
  nextAction: z.string().max(200).optional(),
  nextActionDate: z.string().optional(),
});

/** CA が対応記録を登録する。次回アクションも同時に更新する。 */
export async function recordActionAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'candidate:write');

  const parsed = actionSchema.safeParse({
    candidateId: formData.get('candidateId'),
    actionType: formData.get('actionType'),
    memo: formData.get('memo') ?? undefined,
    nextAction: formData.get('nextAction') ?? undefined,
    nextActionDate: formData.get('nextActionDate') ?? undefined,
  });
  if (!parsed.success) return { error: '入力内容を確認してください。' };
  const input = parsed.data;

  const now = new Date();
  const nextActionDate = input.nextActionDate ? new Date(input.nextActionDate) : null;

  await prisma.candidateAction.create({
    data: {
      candidateId: input.candidateId,
      caId: user.id,
      actionType: input.actionType,
      actionDate: now,
      memo: input.memo || null,
      nextAction: input.nextAction || null,
      nextActionDate,
      actor: 'human',
    },
  });

  await prisma.candidate.update({
    where: { id: input.candidateId },
    data: {
      lastContactDate: now,
      nextAction: input.nextAction || null,
      nextActionDate,
    },
  });

  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'candidate',
    entityId: input.candidateId,
    action: 'update',
    after: { actionType: input.actionType, nextAction: input.nextAction, nextActionDate },
  });

  revalidatePath(`/candidates/${input.candidateId}`);
  return { ok: true };
}

/** フェーズ変更は人が確定する (§51)。 */
export async function updatePhaseAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'candidate:write');
  const candidateId = String(formData.get('candidateId') ?? '');
  const phase = String(formData.get('phase') ?? '');
  if (!CANDIDATE_PHASES.includes(phase as never)) return { error: '不正なフェーズです。' };

  const before = await prisma.candidate.findUnique({ where: { id: candidateId } });
  await prisma.candidate.update({ where: { id: candidateId }, data: { phase } });

  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'candidate',
    entityId: candidateId,
    action: 'update',
    before: { phase: before?.phase },
    after: { phase },
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}

/**
 * CA が AI の状況確認に回答する (§8)。
 * 回答は構造化して candidate と action に反映し、アラートを解消する。
 */
export async function respondToAlertAction(formData: FormData) {
  const user = await requireUser();
  const alertId = String(formData.get('alertId') ?? '');
  const choiceId = String(formData.get('choiceId') ?? '') || undefined;
  const freeText = String(formData.get('freeText') ?? '');

  const alert = await prisma.aiAlert.findUnique({ where: { id: alertId }, include: { candidate: true } });
  if (!alert || !alert.candidateId) return { error: 'アラートが見つかりません。' };
  // CA は自分宛のアラートにのみ回答できる。
  if (user.role === 'CA' && alert.caId !== user.id) return { error: '権限がありません。' };

  const structured = await parseCaResponse(freeText, choiceId);
  const now = new Date();

  await prisma.candidateAction.create({
    data: {
      candidateId: alert.candidateId,
      caId: user.id,
      actionType: 'ai_check',
      actionDate: now,
      memo: `[AI確認への回答: ${structured.statusLabel}] ${structured.memo}`,
      nextAction: structured.nextAction,
      nextActionDate: structured.nextActionDate ? new Date(structured.nextActionDate) : null,
      actor: 'human',
    },
  });

  await prisma.candidate.update({
    where: { id: alert.candidateId },
    data: {
      lastContactDate: structured.lastContactDate ? new Date(structured.lastContactDate) : undefined,
      nextAction: structured.nextAction ?? undefined,
      nextActionDate: structured.nextActionDate ? new Date(structured.nextActionDate) : undefined,
    },
  });

  await prisma.aiAlert.update({
    where: { id: alertId },
    data: { status: 'answered', resolvedAt: now },
  });

  // CA 未回答アラートが立っていれば解消する。
  await prisma.aiAlert.updateMany({
    where: { candidateId: alert.candidateId, alertType: 'ca_no_response', status: 'open' },
    data: { status: 'resolved', resolvedAt: now },
  });

  await prisma.aiInteraction.create({
    data: {
      agentType: 'ca_supervisor',
      candidateId: alert.candidateId,
      userId: user.id,
      alertId,
      question: alert.reason,
      response: freeText || structured.statusLabel,
      structuredResult: toJson(structured),
      confidence: structured.confidence,
    },
  });

  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'ai_alert',
    entityId: alertId,
    action: 'update',
    before: { status: alert.status },
    after: { status: 'answered', structured },
  });

  revalidatePath('/alerts');
  revalidatePath('/dashboard/ca');
  revalidatePath(`/candidates/${alert.candidateId}`);
  return { ok: true, structured };
}

/** 候補者単位で Matching Agent / Market Research Agent を実行する。 */
export async function runCandidateAgentsAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'candidate:read_all');
  const candidateId = String(formData.get('candidateId') ?? '');
  const agent = String(formData.get('agent') ?? 'matching');

  if (agent === 'structuring') await structureCandidate(candidateId);
  else if (agent === 'research') await researchForCandidate(candidateId);
  else await refreshCandidateMatches(candidateId);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath('/matching');
  return { ok: true };
}

/**
 * 見送り理由タグの確定 (§34)。
 * 原文は変更せず、タグと確定者のみ記録する。
 */
export async function confirmRejectionTagAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'candidate:write');
  const applicationId = String(formData.get('applicationId') ?? '');
  const tag = String(formData.get('tag') ?? '');
  if (!REJECTION_TAGS.includes(tag as never)) return { error: '不正なタグです。' };

  const before = await prisma.application.findUnique({ where: { id: applicationId } });
  await prisma.application.update({
    where: { id: applicationId },
    data: { rejectionReasonTag: tag, rejectionTagConfirmedBy: user.id },
  });

  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'application',
    entityId: applicationId,
    action: 'update',
    before: { rejectionReasonTag: before?.rejectionReasonTag },
    after: { rejectionReasonTag: tag },
  });

  revalidatePath(`/candidates/${before?.candidateId}`);
  return { ok: true };
}

/** AI に見送り理由タグを提案させる (確定はしない)。 */
export async function suggestRejectionTagAction(applicationId: string) {
  await requireUser();
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application?.rejectionReasonOriginal) return null;
  return suggestRejectionTag(application.rejectionReasonOriginal);
}
