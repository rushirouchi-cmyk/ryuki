import { AppShell } from '@/components/app-shell';
import { requireAgent } from '@/server/guards';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgent();
  return (
    <AppShell
      title="Agent"
      subtitle="送客候補者の管理"
      currentPath=""
      userName={user.displayName}
      nav={[
        { href: '/agent', label: 'サマリー' },
        { href: '/agent/candidates', label: '候補者一覧' },
      ]}
    >
      {children}
    </AppShell>
  );
}
