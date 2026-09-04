import type { Role } from '@/lib/domain/enums';
import type { SessionUser } from '@/lib/auth';

/**
 * 権限 (§49)。
 * 将来の細分化に備え「role → permission 集合」の写像として定義し、
 * 画面側は role を直接見ずに can() を通す。
 */

export const PERMISSIONS = [
  'candidate:read_all',
  'candidate:read_own',
  'candidate:write',
  'company:read',
  'company:write',
  'job:read',
  'job:write',
  'bd:read',
  'bd:write',
  'alert:read_all',
  'alert:read_own',
  'report:read',
  'settings:write',
  'user:manage',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...PERMISSIONS],
  executive: [
    'candidate:read_all',
    'company:read',
    'job:read',
    'bd:read',
    'alert:read_all',
    'report:read',
    'audit:read',
    'settings:write',
  ],
  CA: [
    'candidate:read_all', // 一覧は閲覧可。既定フィルタは自分の担当 (§49)
    'candidate:read_own',
    'candidate:write',
    'company:read',
    'job:read',
    'alert:read_own',
    'report:read',
  ],
  RA: [
    'candidate:read_all',
    'company:read',
    'company:write',
    'job:read',
    'job:write',
    'bd:read',
    'bd:write',
    'report:read',
  ],
};

export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function assertCan(user: SessionUser | null, permission: Permission) {
  if (!can(user, permission)) throw new Error(`FORBIDDEN: ${permission}`);
}

/** CA は既定で自分の担当候補者に絞り込む。executive/admin/RA は全件。 */
export function defaultCandidateScope(user: SessionUser): { ownerCaId?: string } {
  return user.role === 'CA' ? { ownerCaId: user.id } : {};
}
