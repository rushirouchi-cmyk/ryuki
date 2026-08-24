"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertAgentScope, assertRole } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  getAgentReferral,
  updateReferralStatus,
  type ReferralStatus,
} from "@/lib/domain/agents/service";

export interface AgentActionState {
  error?: string;
  success?: string;
}

const statusSchema = z.object({
  referralId: z.coerce.number().int().positive(),
  status: z.enum([
    "accepted",
    "declined",
    "contacted",
    "interview_scheduled",
    "interview_completed",
    "applied",
    "offer",
    "joined",
    "lost",
  ]),
  offerCompany: z.string().trim().max(120).optional(),
  offerJobTitle: z.string().trim().max(120).optional(),
  offerSalaryYen: z.coerce.number().int().min(0).max(50_000_000).optional(),
  offerDate: z.string().optional(),
  joinedDate: z.string().optional(),
  lostReason: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function updateReferralAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const user = await assertRole("agent", "admin");

  const parsed = statusSchema.safeParse({
    referralId: formData.get("referralId"),
    status: formData.get("status"),
    offerCompany: formData.get("offerCompany") || undefined,
    offerJobTitle: formData.get("offerJobTitle") || undefined,
    offerSalaryYen: formData.get("offerSalaryYen") || undefined,
    offerDate: formData.get("offerDate") || undefined,
    joinedDate: formData.get("joinedDate") || undefined,
    lostReason: formData.get("lostReason") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" };
  }

  const companyId = user.agentCompanyId;
  if (companyId === null) return { error: "所属エージェント企業が設定されていません" };

  const db = await getDb();
  const referral = await getAgentReferral(db, companyId, parsed.data.referralId);
  if (!referral) return { error: "対象の候補者が見つかりません" };
  assertAgentScope(user, referral.agentCompanyId);

  if (parsed.data.status === "offer" && !parsed.data.offerSalaryYen) {
    return { error: "内定時は提示年収の入力が必要です" };
  }
  if (parsed.data.status === "joined" && !parsed.data.joinedDate) {
    return { error: "入社時は入社日の入力が必要です" };
  }

  await updateReferralStatus(
    db,
    referral.id,
    parsed.data.status as ReferralStatus,
    user.id,
    {
      offerCompany: parsed.data.offerCompany,
      offerJobTitle: parsed.data.offerJobTitle,
      offerSalaryYen: parsed.data.offerSalaryYen,
      offerDate: parsed.data.offerDate,
      joinedDate: parsed.data.joinedDate,
      lostReason: parsed.data.lostReason,
      notes: parsed.data.notes,
    },
  );

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "referral.status_update",
    entityType: "referral",
    entityId: referral.id,
    metadata: { status: parsed.data.status },
  });

  revalidatePath(`/agent/candidates/${referral.id}`);
  revalidatePath("/agent/candidates");
  return { success: "ステータスを更新しました" };
}
