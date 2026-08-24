import 'server-only';
import { getDb, schema } from '@/db/client';
import { redactForAudit } from '@/domain/auth/pii';
import type { Role } from '@/domain/auth/rbac';

export async function writeAuditLog(params: {
  actorUserId: string | null;
  actorRole: Role | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await getDb()
    .insert(schema.auditLogs)
    .values({
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: redactForAudit(params.metadata ?? {}),
    });
}
