import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { cn } from "@/lib/utils/cn";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  title,
  userName,
  roleLabel,
  nav,
  children,
  wide = false,
}: {
  title: string;
  userName: string;
  roleLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div
          className={cn(
            "mx-auto flex items-center justify-between gap-4 px-4 py-3",
            wide ? "max-w-7xl" : "max-w-3xl",
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-900">{title}</p>
            <p className="truncate text-xs text-ink-500">
              {roleLabel} / {userName}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-500 hover:bg-ink-100"
            >
              ログアウト
            </button>
          </form>
        </div>
        {nav.length > 0 ? (
          <nav
            className={cn(
              "mx-auto flex gap-1 overflow-x-auto px-2 pb-2",
              wide ? "max-w-7xl" : "max-w-3xl",
            )}
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className={cn("mx-auto px-4 py-6", wide ? "max-w-7xl" : "max-w-3xl")}>
        {children}
      </main>
    </div>
  );
}
