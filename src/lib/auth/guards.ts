import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type Role, type SessionUser } from "./session";

export class ForbiddenError extends Error {
  constructor(message = "この操作を行う権限がありません") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const HOME_BY_ROLE: Record<Role, string> = {
  admin: "/admin",
  sales: "/sales",
  agent: "/agent",
};

export function homeFor(role: Role): string {
  return HOME_BY_ROLE[role];
}

/** Redirects to the login page, then to the caller's own home if role mismatches. */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** Server-action variant: throws instead of redirecting. */
export async function assertRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("ログインが必要です");
  if (!allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}

/**
 * An agent user may only ever touch rows belonging to their own company; an
 * admin may touch any. Sales users have no access to agent data at all.
 */
export function assertAgentScope(user: SessionUser, agentCompanyId: number): void {
  if (user.role === "admin") return;
  if (user.role !== "agent" || user.agentCompanyId !== agentCompanyId) {
    throw new ForbiddenError("他社の候補者情報にはアクセスできません");
  }
}

/** A sales user may only mutate their own shifts and ledger entries. */
export function assertSalesScope(user: SessionUser, salesUserId: string): void {
  if (user.role === "admin") return;
  if (user.role !== "sales" || user.id !== salesUserId) {
    throw new ForbiddenError("他の営業担当のデータは変更できません");
  }
}
