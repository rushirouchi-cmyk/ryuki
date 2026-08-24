'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { requireAgent } from '@/server/guards';
import { assertPermission, canUpdateReferral } from '@/domain/auth/rbac';
import { updateReferralStatus } from '@/server/services/referrals';
import { writeAuditLog } from '@/server/audit';

const updateSchema = z.object({
  referralId: z.string().uuid(),
  status: z.enum(schema.referralStatusEnum.enumValues),
  offerCompanyName: z.string().max(200).optional(),
  offerJobTitle: z.string().max(200).optional(),
  offerSalary: z.coerce.number().int().min(0).max(100_000_000).optional(),
  offerDate: z.string().optional(),
  joinedDate: z.string().optional(),
  lostReason: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export interface ReferralUpdateState {
  error?: string;
  success?: boolean;
}

export async function updateReferralAction(
  _prev: ReferralUpdateState,
  formData: FormData,
): Promise<ReferralUpdateState> {
  const user = await requireAgent();
  const parsed = updateSchema.safeParse({
    referralId: formData.get('referralId'),
    status: formData.get('status'),
    offerCompanyName: formData.get('offerCompanyName') || undefined,
    offerJobTitle: formData.get('offerJobTitle') || undefined,
    offerSalary: formData.get('offerSalary') || undefined,
    offerDate: formData.get('offerDate') || undefined,
    joinedDate: formData.get('joinedDate') || undefined,
    lostReason: formData.get('lostReason') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };
  }

  const referral = await getDb().query.referrals.findFirst({
    where: eq(schema.referrals.id, parsed.data.referralId),
  });
  if (!referral) return { error: '送客が見つかりません。' };

  assertPermission(
    canUpdateReferral(
      { userId: user.userId, role: user.role, agentCompanyId: user.agentCompanyId },
      referral,
    ),
    '他社の候補者は更新できません。',
  );

  if (parsed.data.status === 'offer' && !parsed.data.offerSalary) {
    return { error: '内定登録には提示年収の入力が必要です。' };
  }
  if (parsed.data.status === 'joined' && !parsed.data.joinedDate) {
    return { error: '入社登録には入社日の入力が必要です。' };
  }

  await updateReferralStatus({
    referralId: parsed.data.referralId,
    status: parsed.data.status,
    outcome: {
      offerCompanyName: parsed.data.offerCompanyName ?? null,
      offerJobTitle: parsed.data.offerJobTitle ?? null,
      offerSalary: parsed.data.offerSalary ?? null,
      offerDate: parsed.data.offerDate ?? null,
      joinedDate: parsed.data.joinedDate ?? null,
      lostReason: parsed.data.lostReason ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'referral.update_status',
    entityType: 'referral',
    entityId: parsed.data.referralId,
    metadata: { status: parsed.data.status },
  });

  revalidatePath(`/agent/candidates/${parsed.data.referralId}`);
  revalidatePath('/agent/candidates');
  revalidatePath('/agent');
  return { success: true };
}
