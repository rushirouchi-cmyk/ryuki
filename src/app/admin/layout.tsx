import { AppShell } from '@/components/app-shell';
import { requireAdmin } from '@/server/guards';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <AppShell
      title="Admin"
      subtitle="Career Routing Engine"
      currentPath=""
      userName={user.displayName}
      nav={[
        { href: '/admin', label: 'ダッシュボード' },
        { href: '/admin/funnel', label: 'ファネル' },
        { href: '/admin/areas', label: '地域・時間帯' },
        { href: '/admin/sales', label: '営業担当' },
        { href: '/admin/agents', label: 'エージェント' },
        { href: '/admin/candidates', label: '候補者' },
        { href: '/admin/benchmarks', label: '市場年収' },
        { href: '/admin/diagnosis-settings', label: '診断設定' },
        { href: '/admin/incentive-settings', label: 'インセンティブ' },
      ]}
    >
      {children}
    </AppShell>
  );
}
