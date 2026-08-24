'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { requireAdmin } from '@/server/guards';
import { overrideAttribution } from '@/domain/attribution';
import { diagnosisConfigSchema } from '@/domain/config/diagnosis-config';
import { analyticsConfigSchema } from '@/domain/config/analytics-config';
import { saveAnalyticsConfig, saveDiagnosisConfig } from '@/server/settings';
import { writeAuditLog } from '@/server/audit';

export interface ActionState {
  error?: string;
  success?: string;
}

/* ------------------------------------------------------------ attribution */

const overrideSchema = z.object({
  candidateId: z.string().uuid(),
  qrCodeId: z.string().uuid(),
  reason: z.string().min(1, '修正理由を入力してください').max(500),
});

export async function overrideAttributionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = overrideSchema.safeParse({
    candidateId: formData.get('candidateId'),
    qrCodeId: formData.get('qrCodeId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };

  const db = getDb();
  const qr = await db.query.qrCodes.findFirst({ where: eq(schema.qrCodes.id, parsed.data.qrCodeId) });
  if (!qr) return { error: '指定されたQRコードが見つかりません。' };

  const value = overrideAttribution({
    target: {
      qrCodeId: qr.id,
      salesUserId: qr.salesUserId,
      shiftId: qr.shiftId,
      locationId: qr.locationId,
    },
    adminUserId: user.userId,
    reason: parsed.data.reason,
  });

  await db
    .insert(schema.candidateAttributions)
    .values({ candidateId: parsed.data.candidateId, ...value, attributedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.candidateAttributions.candidateId,
      set: {
        qrCodeId: value.qrCodeId,
        salesUserId: value.salesUserId,
        shiftId: value.shiftId,
        locationId: value.locationId,
        source: value.source,
        overriddenByUserId: value.overriddenByUserId,
        overrideReason: value.overrideReason,
      },
    });

  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'attribution.override',
    entityType: 'candidate',
    entityId: parsed.data.candidateId,
    metadata: { qrCodeId: qr.id, reason: parsed.data.reason },
  });

  revalidatePath(`/admin/candidates/${parsed.data.candidateId}`);
  return { success: 'アトリビューションを修正しました。' };
}

/* --------------------------------------------------------------- settings */

export async function saveDiagnosisConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const number = (key: string) => Number(formData.get(key));

  const candidate = {
    weights: {
      skill: number('weight_skill'),
      certification: number('weight_certification'),
      experience: number('weight_experience'),
      location: number('weight_location'),
      workingCondition: number('weight_workingCondition'),
      educationManagement: number('weight_educationManagement'),
    },
    rankThresholds: { S: number('rank_S'), A: number('rank_A'), B: number('rank_B') },
    transitionAffinityWeight: number('transitionAffinityWeight'),
    minMatchScore: number('minMatchScore'),
    minOptionsShown: number('minOptionsShown'),
    maxOptionsShown: number('maxOptionsShown'),
    salaryRoundingUnit: number('salaryRoundingUnit'),
    experienceFullBonusYears: number('experienceFullBonusYears'),
    marketValue: {
      matchWeight: number('mv_matchWeight'),
      upsideWeight: number('mv_upsideWeight'),
      upsideFullJpy: number('mv_upsideFullJpy'),
    },
    educationScores: {
      high_school: number('edu_high_school'),
      vocational: number('edu_vocational'),
      associate: number('edu_associate'),
      bachelor: number('edu_bachelor'),
      master: number('edu_master'),
      other: number('edu_other'),
    },
    qualifiedMinScore: number('qualifiedMinScore'),
    qualifiedMinUpsideJpy: number('qualifiedMinUpsideJpy'),
  };

  const parsed = diagnosisConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '設定値が正しくありません。' };
  }
  if (parsed.data.rankThresholds.S <= parsed.data.rankThresholds.A) {
    return { error: 'ランク閾値は S > A > B の順である必要があります。' };
  }
  if (parsed.data.rankThresholds.A <= parsed.data.rankThresholds.B) {
    return { error: 'ランク閾値は S > A > B の順である必要があります。' };
  }
  if (parsed.data.minOptionsShown > parsed.data.maxOptionsShown) {
    return { error: '最小表示件数は最大表示件数以下にしてください。' };
  }

  await saveDiagnosisConfig(parsed.data, user.userId);
  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'settings.diagnosis.update',
    entityType: 'app_settings',
    entityId: 'diagnosis_config',
  });
  revalidatePath('/admin/diagnosis-settings');
  return { success: '診断設定を保存しました。以降の診断から反映されます。' };
}

export async function saveAnalyticsConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const number = (key: string) => Number(formData.get(key));
  const raw = formData.get('timeBands');

  let timeBands: unknown;
  try {
    timeBands = JSON.parse(typeof raw === 'string' ? raw : '[]');
  } catch {
    return { error: '時間帯の指定が正しくありません。' };
  }

  const parsed = analyticsConfigSchema.safeParse({
    areaScoreWeights: {
      approachesPerHour: number('as_approachesPerHour'),
      stopRate: number('as_stopRate'),
      scanRate: number('as_scanRate'),
      diagnosisCompletionRate: number('as_diagnosisCompletionRate'),
      leadRate: number('as_leadRate'),
      interviewRate: number('as_interviewRate'),
      qualifiedRate: number('as_qualifiedRate'),
      referralRate: number('as_referralRate'),
      grossProfitPerSalesHour: number('as_grossProfitPerSalesHour'),
    },
    areaScoreCeilings: {
      approachesPerHour: number('ceil_approachesPerHour'),
      grossProfitPerSalesHour: number('ceil_grossProfitPerSalesHour'),
    },
    lowSampleSalesHours: number('lowSampleSalesHours'),
    lowSampleApproaches: number('lowSampleApproaches'),
    otherCostPerSalesHourJpy: number('otherCostPerSalesHourJpy'),
    salesBaseHourlyWageJpy: number('salesBaseHourlyWageJpy'),
    timeBands,
    areaScoreRankThresholds: { S: number('ar_S'), A: number('ar_A'), B: number('ar_B') },
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '設定値が正しくありません。' };
  }

  await saveAnalyticsConfig(parsed.data, user.userId);
  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'settings.analytics.update',
    entityType: 'app_settings',
    entityId: 'analytics_config',
  });
  revalidatePath('/admin/diagnosis-settings');
  return { success: '分析設定を保存しました。' };
}

/* ------------------------------------------------------------- incentives */

const ruleSchema = z.object({
  eventType: z.enum(schema.monetizableEventEnum.enumValues),
  amount: z.coerce.number().int().min(0).max(1_000_000),
  description: z.string().max(200).optional(),
  validFrom: z.string().min(1),
  validTo: z.string().optional(),
  minMarketValueScore: z.coerce.number().min(0).max(100).optional(),
});

export async function createIncentiveRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = ruleSchema.safeParse({
    eventType: formData.get('eventType'),
    amount: formData.get('amount'),
    description: formData.get('description') || undefined,
    validFrom: formData.get('validFrom'),
    validTo: formData.get('validTo') || undefined,
    minMarketValueScore: formData.get('minMarketValueScore') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };

  const validFrom = new Date(parsed.data.validFrom);
  const validTo = parsed.data.validTo ? new Date(parsed.data.validTo) : null;
  if (Number.isNaN(validFrom.getTime())) return { error: '適用開始日が正しくありません。' };
  if (validTo && validTo <= validFrom) return { error: '適用終了日は開始日より後にしてください。' };

  await getDb()
    .insert(schema.incentiveRules)
    .values({
      eventType: parsed.data.eventType,
      amount: parsed.data.amount,
      description: parsed.data.description,
      validFrom,
      validTo,
      conditions:
        parsed.data.minMarketValueScore !== undefined
          ? { minMarketValueScore: parsed.data.minMarketValueScore }
          : {},
    });

  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'incentive_rule.create',
    entityType: 'incentive_rule',
    metadata: { eventType: parsed.data.eventType, amount: parsed.data.amount },
  });
  revalidatePath('/admin/incentive-settings');
  return { success: 'インセンティブルールを追加しました。' };
}

export async function toggleIncentiveRuleAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const ruleId = String(formData.get('ruleId') ?? '');
  const active = formData.get('active') === 'true';
  if (!ruleId) return;

  await getDb().update(schema.incentiveRules).set({ active }).where(eq(schema.incentiveRules.id, ruleId));
  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'incentive_rule.toggle',
    entityType: 'incentive_rule',
    entityId: ruleId,
    metadata: { active },
  });
  revalidatePath('/admin/incentive-settings');
}

export async function updateLedgerStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const entryId = String(formData.get('entryId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!entryId || !schema.incentiveStatusEnum.enumValues.includes(status as 'pending')) return;

  await getDb()
    .update(schema.incentiveLedger)
    .set({
      status: status as 'pending',
      approvedAt: status === 'approved' || status === 'paid' ? new Date() : null,
      approvedByUserId: status === 'approved' || status === 'paid' ? user.userId : null,
    })
    .where(eq(schema.incentiveLedger.id, entryId));

  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'incentive_ledger.update_status',
    entityType: 'incentive_ledger',
    entityId: entryId,
    metadata: { status },
  });
  revalidatePath('/admin/incentive-settings');
}

/* ------------------------------------------------- salary benchmark master */

const benchmarkSchema = z
  .object({
    occupationId: z.string().uuid('職種を選択してください'),
    regionId: z.string().uuid('地域を選択してください'),
    experienceBand: z.enum(schema.experienceBandEnum.enumValues),
    educationLevel: z.enum(schema.educationLevelEnum.enumValues).optional(),
    salaryLow: z.coerce.number().int().min(0).max(100_000_000),
    salaryMedian: z.coerce.number().int().min(0).max(100_000_000),
    salaryHigh: z.coerce.number().int().min(0).max(100_000_000),
    source: z.string().min(1).max(60),
    sourceDate: z.string().min(1),
    confidenceLevel: z.enum(schema.confidenceLevelEnum.enumValues),
    sampleSize: z.coerce.number().int().min(0).optional(),
  })
  .refine((value) => value.salaryLow <= value.salaryMedian && value.salaryMedian <= value.salaryHigh, {
    message: '年収は low ≦ median ≦ high の順で入力してください',
  });

export async function upsertBenchmarkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = benchmarkSchema.safeParse({
    occupationId: formData.get('occupationId'),
    regionId: formData.get('regionId'),
    experienceBand: formData.get('experienceBand'),
    educationLevel: formData.get('educationLevel') || undefined,
    salaryLow: formData.get('salaryLow'),
    salaryMedian: formData.get('salaryMedian'),
    salaryHigh: formData.get('salaryHigh'),
    source: formData.get('source') || 'manual',
    sourceDate: formData.get('sourceDate'),
    confidenceLevel: formData.get('confidenceLevel') || 'medium',
    sampleSize: formData.get('sampleSize') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };

  const values = {
    ...parsed.data,
    educationLevel: parsed.data.educationLevel ?? null,
    sampleSize: parsed.data.sampleSize ?? null,
    updatedAt: new Date(),
  };

  await getDb()
    .insert(schema.salaryMarketBenchmarks)
    .values(values)
    .onConflictDoUpdate({
      target: [
        schema.salaryMarketBenchmarks.occupationId,
        schema.salaryMarketBenchmarks.regionId,
        schema.salaryMarketBenchmarks.experienceBand,
        schema.salaryMarketBenchmarks.educationLevel,
      ],
      set: {
        salaryLow: values.salaryLow,
        salaryMedian: values.salaryMedian,
        salaryHigh: values.salaryHigh,
        source: values.source,
        sourceDate: values.sourceDate,
        confidenceLevel: values.confidenceLevel,
        sampleSize: values.sampleSize,
        updatedAt: values.updatedAt,
      },
    });

  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'salary_benchmark.upsert',
    entityType: 'salary_market_benchmark',
    metadata: {
      occupationId: parsed.data.occupationId,
      regionId: parsed.data.regionId,
      experienceBand: parsed.data.experienceBand,
    },
  });
  revalidatePath('/admin/benchmarks');
  return { success: '市場年収データを保存しました。' };
}

export async function deleteBenchmarkAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(formData.get('benchmarkId') ?? '');
  if (!id) return;
  await getDb().delete(schema.salaryMarketBenchmarks).where(eq(schema.salaryMarketBenchmarks.id, id));
  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'salary_benchmark.delete',
    entityType: 'salary_market_benchmark',
    entityId: id,
  });
  revalidatePath('/admin/benchmarks');
}
