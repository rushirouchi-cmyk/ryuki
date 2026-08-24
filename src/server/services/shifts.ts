import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { canModifyShift, assertPermission, type Principal } from '@/domain/auth/rbac';
import { generateToken } from '@/server/tokens';

export type VenueType = (typeof schema.venueTypeEnum.enumValues)[number];
export type Weather = (typeof schema.weatherEnum.enumValues)[number];

export interface StartShiftParams {
  salesUserId: string;
  locationId: string;
  startTime: Date;
  plannedEndTime: Date | null;
  weather: Weather | null;
  venueType: VenueType;
  memo?: string | null;
}

export interface StartedShift {
  shiftId: string;
  qrToken: string;
}

/** Starting a shift always mints a QR code bound to rep x location x shift. */
export async function startShift(params: StartShiftParams): Promise<StartedShift> {
  const db = getDb();
  const inserted = await db
    .insert(schema.shifts)
    .values({
      salesUserId: params.salesUserId,
      locationId: params.locationId,
      startTime: params.startTime,
      plannedEndTime: params.plannedEndTime,
      weather: params.weather,
      venueType: params.venueType,
      memo: params.memo ?? null,
      status: 'active',
    })
    .returning();
  const shift = inserted[0];
  if (!shift) throw new Error('シフトの作成に失敗しました。');

  const token = generateToken(12);
  await db.insert(schema.qrCodes).values({
    token,
    shiftId: shift.id,
    salesUserId: params.salesUserId,
    locationId: params.locationId,
  });

  return { shiftId: shift.id, qrToken: token };
}

export async function getActiveShift(salesUserId: string) {
  return getDb().query.shifts.findFirst({
    where: and(eq(schema.shifts.salesUserId, salesUserId), eq(schema.shifts.status, 'active')),
    with: { location: true, qrCodes: true },
  });
}

export async function adjustCounter(params: {
  principal: Principal;
  shiftId: string;
  counter: 'approach' | 'stopped';
  delta: number;
}): Promise<void> {
  const db = getDb();
  const shift = await db.query.shifts.findFirst({ where: eq(schema.shifts.id, params.shiftId) });
  if (!shift) throw new Error('シフトが見つかりません。');
  assertPermission(canModifyShift(params.principal, shift), '他の営業担当のシフトは変更できません。');

  const column = params.counter === 'approach' ? schema.shifts.approachCount : schema.shifts.stoppedCount;
  await db
    .update(schema.shifts)
    .set({
      [params.counter === 'approach' ? 'approachCount' : 'stoppedCount']: sql`greatest(0, ${column} + ${params.delta})`,
    })
    .where(eq(schema.shifts.id, params.shiftId));
}

export async function closeShift(params: { principal: Principal; shiftId: string }): Promise<void> {
  const db = getDb();
  const shift = await db.query.shifts.findFirst({ where: eq(schema.shifts.id, params.shiftId) });
  if (!shift) throw new Error('シフトが見つかりません。');
  assertPermission(canModifyShift(params.principal, shift), '他の営業担当のシフトは変更できません。');

  await db
    .update(schema.shifts)
    .set({ status: 'closed', endTime: new Date() })
    .where(eq(schema.shifts.id, params.shiftId));
  await db.update(schema.qrCodes).set({ active: false }).where(eq(schema.qrCodes.shiftId, params.shiftId));
}

export interface ShiftFunnelRow {
  eventType: string;
  candidateId: string;
}

/** Funnel counts for one shift, derived from the event log. */
export async function getShiftEvents(shiftId: string): Promise<ShiftFunnelRow[]> {
  const rows = await getDb()
    .select({
      eventType: schema.candidateEvents.eventType,
      candidateId: schema.candidateEvents.candidateId,
    })
    .from(schema.candidateEvents)
    .where(eq(schema.candidateEvents.shiftId, shiftId));
  return rows;
}

export async function getSalesEventsSince(salesUserId: string, since: Date): Promise<ShiftFunnelRow[]> {
  return getDb()
    .select({
      eventType: schema.candidateEvents.eventType,
      candidateId: schema.candidateEvents.candidateId,
    })
    .from(schema.candidateEvents)
    .innerJoin(
      schema.candidateAttributions,
      eq(schema.candidateAttributions.candidateId, schema.candidateEvents.candidateId),
    )
    .where(
      and(
        eq(schema.candidateAttributions.salesUserId, salesUserId),
        gte(schema.candidateEvents.createdAt, since),
      ),
    );
}

export function shiftHours(
  shift: { startTime: Date; endTime: Date | null },
  now: Date = new Date(),
): number {
  const end = shift.endTime ?? now;
  return Math.max(0, (end.getTime() - shift.startTime.getTime()) / 3_600_000);
}
