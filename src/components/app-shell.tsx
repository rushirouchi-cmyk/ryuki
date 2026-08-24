import Link from 'next/link';
import clsx from 'clsx';
import { logoutAction } from '@/app/login/actions';

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  title,
  subtitle,
  nav,
  currentPath,
  userName,
  children,
  variant = 'desktop',
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  currentPath: string;
  userName: string;
  children: React.ReactNode;
  variant?: 'desktop' | 'mobile';
}) {
  const isMobile = variant === 'mobile';

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div
          className={clsx(
            'mx-auto flex items-center justify-between gap-4 px-5 py-3',
            isMobile ? 'max-w-md' : 'max-w-7xl',
          )}
        >
          <div>
            <p className="text-sm font-bold text-ink-900">{title}</p>
            {subtitle && <p className="text-[11px] text-ink-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-500 sm:inline">{userName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-ink-700 hover:bg-slate-50"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
        <nav
          className={clsx(
            'mx-auto flex gap-1 overflow-x-auto px-5 pb-2',
            isMobile ? 'max-w-md' : 'max-w-7xl',
          )}
        >
          {nav.map((item) => {
            const active = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-slate-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className={clsx('mx-auto px-5 py-6', isMobile ? 'max-w-md' : 'max-w-7xl')}>{children}</main>
    </div>
  );
}
