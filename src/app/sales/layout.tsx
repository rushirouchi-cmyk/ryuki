import { AppShell } from '@/components/app-shell';
import { requireSales } from '@/server/guards';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSales();
  return (
    <AppShell
      title="Sales"
      subtitle="街頭営業"
      variant="mobile"
      currentPath=""
      userName={user.displayName}
      nav={[
        { href: '/sales', label: '今日の実績' },
        { href: '/sales/shift', label: 'シフト・QR' },
        { href: '/sales/incentives', label: '報酬明細' },
      ]}
    >
      {children}
    </AppShell>
  );
}
