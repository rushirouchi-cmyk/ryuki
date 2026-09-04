'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertCan } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import { BD_STATUSES } from '@/lib/domain/enums';
import { runBusinessDevelopmentRanking } from '@/lib/agents/business-development';

/** 営業進捗と担当 RA の更新 (§29)。人が管理する項目のため AI は上書きしない。 */
export async function updateOpportunityAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'bd:write');

  const id = String(formData.get('opportunityId') ?? '');
  const status = String(formData.get('status') ?? '');
  const ownerRaId = String(formData.get('ownerRaId') ?? '') || null;
  if (!BD_STATUSES.includes(status as never)) return { error: '不正な営業進捗です。' };

  const before = await prisma.businessDevelopmentOpportunity.findUnique({ where: { id } });
  await prisma.businessDevelopmentOpportunity.update({
    where: { id },
    data: { status, ownerRaId },
  });

  // 契約に至った企業は取引状況を既存へ、アプローチ済は開拓中へ更新する。
  if (before) {
    const transactionStatus = status === 'contracted' ? 'existing' : status === 'not_started' ? undefined : 'prospect';
    if (transactionStatus) {
      await prisma.company.update({
        where: { id: before.companyId },
        data: { transactionStatus, relationshipStatus: status },
      });
    }
  }

  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'business_development_opportunity',
    entityId: id,
    action: 'update',
    before: { status: before?.status, ownerRaId: before?.ownerRaId },
    after: { status, ownerRaId },
  });

  revalidatePath('/business-development');
  return { ok: true };
}

/** Business Development Agent を手動実行する。 */
export async function rerankOpportunitiesAction() {
  const user = await requireUser();
  assertCan(user, 'bd:write');
  const result = await runBusinessDevelopmentRanking();
  revalidatePath('/business-development');
  return { ok: true, evaluated: result.evaluated };
}
