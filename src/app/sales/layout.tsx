import { requireRole } from "@/lib/auth/guards";
import { AppShell } from "@/components/layout/app-shell";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("sales", "admin");

  return (
    <AppShell
      title="営業ダッシュボード"
      roleLabel="営業"
      userName={user.name}
      nav={[
        { href: "/sales", label: "本日" },
        { href: "/sales/shift/new", label: "営業開始" },
        { href: "/sales/incentives", label: "報酬明細" },
      ]}
    >
      {children}
    </AppShell>
  );
}
