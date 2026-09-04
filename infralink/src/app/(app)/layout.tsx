import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { ROLE_LABELS } from '@/lib/domain/enums';
import { logoutAction } from '@/app/actions/auth';
import { prisma } from '@/lib/db';
import { GlobalSearch } from '@/components/global-search';

/**
 * アプリ共通シェル。
 * 左ナビは権限で出し分ける (§49)。上部にグローバル検索 (§47)。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const openCritical = await prisma.aiAlert.count({
    where: { status: { in: ['open', 'escalated'] }, alertLevel: 3, ...(user.role === 'CA' ? { caId: user.id } : {}) },
  });

  const nav = [
    { href: '/dashboard/ca', label: '今日やること', show: can(user, 'candidate:read_own') || user.role !== 'RA' },
    { href: '/dashboard/executive', label: 'Executive Dashboard', show: can(user, 'alert:read_all') },
    { href: '/candidates', label: '候補者', show: can(user, 'candidate:read_all') },
    { href: '/jobs', label: '求人', show: can(user, 'job:read') },
    { href: '/companies', label: '企業', show: can(user, 'company:read') },
    { href: '/matching', label: 'AI Matching', show: can(user, 'candidate:read_all') },
    { href: '/business-development', label: '新規開拓', show: can(user, 'bd:read') },
    { href: '/alerts', label: 'アラート', show: true },
    { href: '/knowledge', label: 'ナレッジ分析', show: can(user, 'report:read') },
    { href: '/admin/settings', label: '設定', show: can(user, 'settings:write') },
    { href: '/admin/audit', label: '監査ログ', show: can(user, 'audit:read') },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen">
      <nav className="flex w-52 shrink-0 flex-col border-r border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <Link href="/" className="text-sm font-semibold leading-tight">
            INFRALINK
          </Link>
          <p className="text-xxs text-[var(--text-muted)]">Talent Intelligence</p>
        </div>

        <ul className="flex-1 space-y-0.5 p-2">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-[var(--bg-subtle)]"
              >
                <span>{item.label}</span>
                {item.href === '/alerts' && openCritical > 0 && (
                  <span className="tabular rounded border border-crit-line bg-crit-bg px-1 text-xxs font-semibold text-crit-fg">
                    ■{openCritical}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-t border-[var(--border)] p-3">
          <p className="text-xs font-medium">{user.name}</p>
          <p className="text-xxs text-[var(--text-muted)]">{ROLE_LABELS[user.role]}</p>
          <form action={logoutAction}>
            <button className="mt-2 w-full rounded border border-[var(--border)] px-2 py-1 text-xxs hover:bg-[var(--bg-subtle)]">
              ログアウト
            </button>
          </form>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-white px-6 py-2">
          <GlobalSearch />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
