"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  candidates,
  incentiveLedger,
  incentiveRules,
  qrCodes,
  revenueEvents,
  shifts,
} from "@/lib/db/schema";
import { assertRole } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/auth/audit";
import { overrideAttribution } from "@/lib/domain/attribution/engine";
import {
  agentMatchingConfigSchema,
  areaScoreConfigSchema,
  diagnosisConfigSchema,
  qualificationConfigSchema,
  SETTING_KEYS,
} from "@/lib/config/settings";
import { writeSetting } from "@/lib/config/store";

export interface AdminActionState {
  error?: string;
  success?: string;
}

/* -------------------------------------------------------------------------- */
/* Attribution correction                                                     */
/* -------------------------------------------------------------------------- */

const attributionSchema = z.object({
  candidateId: z.uuid(),
  salesUserId: z.uuid(),
  reason: z.string().trim().min(1, "修正理由を入力してください").max(200),
});

/**
 * The only path that may move an already-locked attribution. Every correction
 * is audit-logged with a reason, because it moves someone's commission.
 */
export async function overrideAttributionAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await assertRole("admin");
  const parsed = attributionSchema.safeParse({
    candidateId: formData.get("candidateId"),
    salesUserId: formData.get("salesUserId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" };
  }

  const db = await getDb();

  /* Re-point the candidate at that rep's most recent shift, so the location and
   * QR stay internally consistent with the new owner. */
  const [shift] = await db
    .select({ id: shifts.id, locationId: shifts.locationId })
    .from(shifts)
    .where(eq(shifts.salesUserId, parsed.data.salesUserId))
    .orderBy(shifts.startTime)
    .limit(1);

  const [qr] = shift
    ? await db
        .select({ id: qrCodes.id })
        .from(qrCodes)
        .where(eq(qrCodes.shiftId, shift.id))
        .limit(1)
    : [];

  const attribution = overrideAttribution({
    qrCodeId: qr?.id ?? null,
    salesUserId: parsed.data.salesUserId,
    shiftId: shift?.id ?? null,
    locationId: shift?.locationId ?? null,
    source: "manual",
  });

  await db
    .update(candidates)
    .set({
      qrCodeId: attribution.qrCodeId,
      salesUserId: attribution.salesUserId,
      shiftId: attribution.shiftId,
      locationId: attribution.locationId,
      attributionSource: "manual",
      attributionOverriddenBy: user.id,
      attributionOverrideReason: parsed.data.reason,
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, parsed.data.candidateId));

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "candidate.attribution_override",
    entityType: "candidate",
    entityId: parsed.data.candidateId,
    metadata: { salesUserId: parsed.data.salesUserId, reason: parsed.data.reason },
  });

  revalidatePath(`/admin/candidates/${parsed.data.candidateId}`);
  return { success: "紐づけを修正しました" };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

const SETTING_SCHEMAS = {
  [SETTING_KEYS.diagnosis]: diagnosisConfigSchema,
  [SETTING_KEYS.areaScore]: areaScoreConfigSchema,
  [SETTING_KEYS.agentMatching]: agentMatchingConfigSchema,
  [SETTING_KEYS.qualification]: qualificationConfigSchema,
} as const;

export async function saveSettingAction(
  key: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await assertRole("admin");
  const schema = SETTING_SCHEMAS[key as keyof typeof SETTING_SCHEMAS];
  if (!schema) return { error: "不明な設定項目です" };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("value") ?? ""));
  } catch {
    return { error: "JSONの形式が正しくありません" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: `設定値が不正です: ${issue?.path.join(".")} ${issue?.message ?? ""}`,
    };
  }

  if (key === SETTING_KEYS.diagnosis) {
    const weights = (parsed.data as { weights: Record<string, number> }).weights;
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    if (Math.round(total) !== 100) {
      return { error: `重みの合計を100にしてください（現在 ${total}）` };
    }
  }

  const db = await getDb();
  await writeSetting(key as never, parsed.data, user.id, db);
  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "settings.update",
    entityType: "app_setting",
    entityId: key,
  });

  revalidatePath("/admin/diagnosis-settings");
  revalidatePath("/admin/incentive-settings");
  return { success: "設定を保存しました" };
}

/* -------------------------------------------------------------------------- */
/* Incentive rules & ledger                                                   */
/* -------------------------------------------------------------------------- */

const ruleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(80),
  eventType: z.enum([
    "diagnosis_completed",
    "lead_registered",
    "interview_booked",
    "interview_completed",
    "candidate_qualified",
    "agent_referred",
    "offer",
    "joined",
  ]),
  amountYen: z.coerce.number().int().min(0).max(1_000_000),
  validFrom: z.string().min(1),
  validTo: z.string().optional(),
  active: z.coerce.boolean(),
  priority: z.coerce.number().int().min(1).max(1000),
  conditions: z.string().optional(),
});

export async function saveIncentiveRuleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await assertRole("admin");
  const parsed = ruleSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    eventType: formData.get("eventType"),
    amountYen: formData.get("amountYen"),
    validFrom: formData.get("validFrom"),
    validTo: formData.get("validTo") || undefined,
    active: formData.get("active") === "on",
    priority: formData.get("priority") || 100,
    conditions: formData.get("conditions") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" };
  }

  let conditions: Record<string, unknown> | null = null;
  if (parsed.data.conditions && parsed.data.conditions.trim().length > 0) {
    try {
      conditions = JSON.parse(parsed.data.conditions) as Record<string, unknown>;
    } catch {
      return { error: "条件JSONの形式が正しくありません" };
    }
  }

  const db = await getDb();
  const values = {
    name: parsed.data.name,
    eventType: parsed.data.eventType,
    amountYen: parsed.data.amountYen,
    validFrom: parsed.data.validFrom,
    validTo: parsed.data.validTo ?? null,
    active: parsed.data.active,
    priority: parsed.data.priority,
    conditions,
  };

  if (parsed.data.id) {
    await db.update(incentiveRules).set(values).where(eq(incentiveRules.id, parsed.data.id));
  } else {
    await db.insert(incentiveRules).values(values);
  }

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: parsed.data.id ? "incentive_rule.update" : "incentive_rule.create",
    entityType: "incentive_rule",
    entityId: parsed.data.id ?? null,
    metadata: { eventType: parsed.data.eventType, amountYen: parsed.data.amountYen },
  });

  revalidatePath("/admin/incentive-settings");
  return { success: "報酬ルールを保存しました" };
}

const ledgerStatusSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1),
  status: z.enum(["pending", "approved", "rejected", "paid"]),
});

export async function updateLedgerStatusAction(formData: FormData): Promise<void> {
  const user = await assertRole("admin");
  const parsed = ledgerStatusSchema.safeParse({
    ids: formData.getAll("ledgerId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const db = await getDb();
  const now = new Date();
  await db
    .update(incentiveLedger)
    .set({
      status: parsed.data.status,
      approvedAt: parsed.data.status === "approved" ? now : null,
      approvedBy: parsed.data.status === "approved" ? user.id : null,
      paidAt: parsed.data.status === "paid" ? now : null,
    })
    .where(inArray(incentiveLedger.id, parsed.data.ids));

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "incentive_ledger.status",
    entityType: "incentive_ledger",
    metadata: { count: parsed.data.ids.length, status: parsed.data.status },
  });

  revalidatePath("/admin/incentive-settings");
}

export async function confirmRevenueAction(formData: FormData): Promise<void> {
  const user = await assertRole("admin");
  const ids = formData
    .getAll("revenueEventId")
    .map((value) => Number(value))
    .filter(Number.isInteger);
  if (ids.length === 0) return;

  const db = await getDb();
  await db
    .update(revenueEvents)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(inArray(revenueEvents.id, ids));

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "revenue.confirm",
    entityType: "revenue_event",
    metadata: { count: ids.length },
  });

  revalidatePath("/admin/incentive-settings");
}
