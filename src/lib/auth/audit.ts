import type { Database } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export interface AuditInput {
  userId: string | null;
  role: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown>;
}

const PII_KEYS = new Set([
  "email",
  "phone",
  "fullName",
  "fullNameKana",
  "password",
  "passwordHash",
]);

/** Audit rows record *what changed*, never the personal data that changed. */
export function redactPii(metadata: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    output[key] = PII_KEYS.has(key) ? "[redacted]" : value;
  }
  return output;
}

export async function writeAuditLog(db: Database, input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    userId: input.userId,
    role: input.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId === null || input.entityId === undefined
      ? null
      : String(input.entityId),
    metadata: input.metadata ? redactPii(input.metadata) : null,
  });
}
