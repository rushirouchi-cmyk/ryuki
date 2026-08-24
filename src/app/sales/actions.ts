"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { locations, qrCodes, shiftCounterEvents, shifts } from "@/lib/db/schema";
import { assertRole, assertSalesScope, ForbiddenError } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/auth/audit";
import { generateToken } from "@/lib/utils/token";

export interface SalesActionState {
  error?: string;
}

const startShiftSchema = z.object({
  locationId: z.coerce.number().int().positive(),
  startTime: z.string().min(1),
  plannedEndTime: z.string().min(1),
  weather: z
    .enum(["sunny", "cloudy", "rainy", "snowy", "hot", "cold"])
    .optional()
    .or(z.literal("")),
  memo: z.string().max(500).optional(),
});

export async function startShiftAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  const user = await assertRole("sales", "admin");

  const parsed = startShiftSchema.safeParse({
    locationId: formData.get("locationId"),
    startTime: formData.get("startTime"),
    plannedEndTime: formData.get("plannedEndTime"),
    weather: formData.get("weather") ?? "",
    memo: formData.get("memo") ?? "",
  });
  if (!parsed.success) return { error: "入力内容をご確認ください" };

  const startTime = new Date(parsed.data.startTime);
  const plannedEndTime = new Date(parsed.data.plannedEndTime);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(plannedEndTime.getTime())) {
    return { error: "日時の形式が正しくありません" };
  }
  if (plannedEndTime <= startTime) {
    return { error: "終了予定時刻は開始時刻より後にしてください" };
  }

  const db = await getDb();
  const [location] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, parsed.data.locationId))
    .limit(1);
  if (!location) return { error: "営業場所が見つかりません" };

  const [shift] = await db
    .insert(shifts)
    .values({
      salesUserId: user.id,
      locationId: location.id,
      startTime,
      plannedEndTime,
      weather: parsed.data.weather ? parsed.data.weather : null,
      venueType: location.venueType,
      memo: parsed.data.memo || null,
      status: "active",
    })
    .returning({ id: shifts.id });
  if (!shift) return { error: "営業シフトを作成できませんでした" };

  /* One QR per sales rep x location x shift; the token carries nothing else. */
  await db.insert(qrCodes).values({
    token: generateToken(9),
    shiftId: shift.id,
    salesUserId: user.id,
    locationId: location.id,
  });

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "shift.start",
    entityType: "shift",
    entityId: shift.id,
    metadata: { locationId: location.id },
  });

  redirect(`/sales/shift/${shift.id}`);
}

const counterSchema = z.object({
  shiftId: z.coerce.number().int().positive(),
  counterType: z.enum(["approach", "stopped"]),
  delta: z.coerce.number().int().min(-1).max(1),
});

/** Counter taps and their corrections are both recorded, never overwritten. */
export async function adjustCounterAction(formData: FormData): Promise<void> {
  const user = await assertRole("sales", "admin");
  const parsed = counterSchema.safeParse({
    shiftId: formData.get("shiftId"),
    counterType: formData.get("counterType"),
    delta: formData.get("delta"),
  });
  if (!parsed.success || parsed.data.delta === 0) return;

  const db = await getDb();
  const [shift] = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, parsed.data.shiftId))
    .limit(1);
  if (!shift) throw new ForbiddenError("営業シフトが見つかりません");
  assertSalesScope(user, shift.salesUserId);

  const column =
    parsed.data.counterType === "approach" ? shifts.approachCount : shifts.stoppedCount;

  await db
    .update(shifts)
    .set(
      parsed.data.counterType === "approach"
        ? { approachCount: sql`greatest(0, ${column} + ${parsed.data.delta})`, updatedAt: new Date() }
        : { stoppedCount: sql`greatest(0, ${column} + ${parsed.data.delta})`, updatedAt: new Date() },
    )
    .where(eq(shifts.id, shift.id));

  await db.insert(shiftCounterEvents).values({
    shiftId: shift.id,
    userId: user.id,
    counterType: parsed.data.counterType,
    delta: parsed.data.delta,
  });

  revalidatePath(`/sales/shift/${shift.id}`);
}

export async function endShiftAction(formData: FormData): Promise<void> {
  const user = await assertRole("sales", "admin");
  const shiftId = Number(formData.get("shiftId"));
  if (!Number.isInteger(shiftId)) return;

  const db = await getDb();
  const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  if (!shift) throw new ForbiddenError("営業シフトが見つかりません");
  assertSalesScope(user, shift.salesUserId);

  await db
    .update(shifts)
    .set({ status: "ended", endTime: new Date(), updatedAt: new Date() })
    .where(eq(shifts.id, shiftId));

  /* Retiring the QR stops late scans from crediting a finished shift. */
  await db
    .update(qrCodes)
    .set({ active: false, revokedAt: new Date() })
    .where(and(eq(qrCodes.shiftId, shiftId), eq(qrCodes.active, true)));

  await writeAuditLog(db, {
    userId: user.id,
    role: user.role,
    action: "shift.end",
    entityType: "shift",
    entityId: shiftId,
  });

  redirect("/sales");
}
