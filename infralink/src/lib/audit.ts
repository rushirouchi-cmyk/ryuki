import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';

/**
 * 監査ログ (§50)。AI による変更は actorType='AI' で記録し、
 * 人間の操作と区別できるようにする。
 */

export type AuditActor =
  | { type: 'human'; id: string; label?: string }
  | { type: 'AI'; label: string }
  | { type: 'system'; label: string };

export async function writeAudit(params: {
  actor: AuditActor;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'notify' | 'escalate';
  before?: unknown;
  after?: unknown;
}) {
  const { actor, entityType, entityId, action, before, after } = params;
  await prisma.auditLog.create({
    data: {
      actorType: actor.type,
      actorId: actor.type === 'human' ? actor.id : null,
      actorLabel: actor.label ?? (actor.type === 'human' ? undefined : actor.type),
      entityType,
      entityId,
      action,
      before: before === undefined ? null : toJson(before),
      after: after === undefined ? null : toJson(after),
    },
  });
}
