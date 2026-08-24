'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { schema } from '@/db/client';
import { requireSales } from '@/server/guards';
import { adjustCounter, closeShift, startShift } from '@/server/services/shifts';
import { writeAuditLog } from '@/server/audit';

const startShiftSchema = z.object({
  locationId: z.string().uuid('営業場所を選択してください'),
  startTime: z.string().min(1),
  plannedEndTime: z.string().optional(),
  weather: z.enum(schema.weatherEnum.enumValues).optional(),
  venueType: z.enum(schema.venueTypeEnum.enumValues),
  memo: z.string().max(500).optional(),
});

export interface ShiftState {
  error?: string;
}

export async function startShiftAction(_prev: ShiftState, formData: FormData): Promise<ShiftState> {
  const user = await requireSales();
  const parsed = startShiftSchema.safeParse({
    locationId: formData.get('locationId'),
    startTime: formData.get('startTime'),
    plannedEndTime: formData.get('plannedEndTime') || undefined,
    weather: formData.get('weather') || undefined,
    venueType: formData.get('venueType'),
    memo: formData.get('memo') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください。' };
  }

  const startTime = new Date(parsed.data.startTime);
  if (Number.isNaN(startTime.getTime())) return { error: '開始時刻が正しくありません。' };
  const plannedEndTime = parsed.data.plannedEndTime ? new Date(parsed.data.plannedEndTime) : null;

  const { shiftId } = await startShift({
    salesUserId: user.userId,
    locationId: parsed.data.locationId,
    startTime,
    plannedEndTime: plannedEndTime && !Number.isNaN(plannedEndTime.getTime()) ? plannedEndTime : null,
    weather: parsed.data.weather ?? null,
    venueType: parsed.data.venueType,
    memo: parsed.data.memo ?? null,
  });

  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'shift.start',
    entityType: 'shift',
    entityId: shiftId,
    metadata: { locationId: parsed.data.locationId },
  });

  redirect('/sales/shift');
}

export async function adjustCounterAction(formData: FormData): Promise<void> {
  const user = await requireSales();
  const shiftId = String(formData.get('shiftId') ?? '');
  const counter = String(formData.get('counter') ?? '');
  const delta = Number(formData.get('delta') ?? 0);
  if (!shiftId || (counter !== 'approach' && counter !== 'stopped')) return;
  if (![1, -1].includes(delta)) return;

  await adjustCounter({
    principal: { userId: user.userId, role: user.role, agentCompanyId: user.agentCompanyId },
    shiftId,
    counter,
    delta,
  });
  revalidatePath('/sales');
  revalidatePath('/sales/shift');
}

export async function closeShiftAction(formData: FormData): Promise<void> {
  const user = await requireSales();
  const shiftId = String(formData.get('shiftId') ?? '');
  if (!shiftId) return;

  await closeShift({
    principal: { userId: user.userId, role: user.role, agentCompanyId: user.agentCompanyId },
    shiftId,
  });
  await writeAuditLog({
    actorUserId: user.userId,
    actorRole: user.role,
    action: 'shift.close',
    entityType: 'shift',
    entityId: shiftId,
  });
  revalidatePath('/sales');
  redirect('/sales');
}
