import { requireRole } from "@/lib/auth/guards";
import { AppShell } from "@/components/layout/app-shell";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  /* Agents only. Admins review agency performance from /admin/agents, so no
   * account can ever be in a state where it sees two companies' candidates. */
  const user = await requireRole("agent");

  return (
    <AppShell
      title={user.agentCompanyName ?? "エージェント"}
      roleLabel="エージェント"
      userName={user.name}
      nav={[
        { href: "/agent", label: "サマリー" },
        { href: "/agent/candidates", label: "紹介候補者" },
      ]}
    >
      {children}
    </AppShell>
  );
}
