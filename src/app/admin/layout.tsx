import { requireRole } from "@/lib/auth/guards";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");

  return (
    <AppShell
      wide
      title="Career Routing Engine 管理"
      roleLabel="管理者"
      userName={user.name}
      nav={[
        { href: "/admin", label: "サマリー" },
        { href: "/admin/funnel", label: "ファネル" },
        { href: "/admin/areas", label: "エリア分析" },
        { href: "/admin/timebands", label: "時間帯分析" },
        { href: "/admin/sales", label: "営業担当" },
        { href: "/admin/agents", label: "エージェント" },
        { href: "/admin/candidates", label: "候補者" },
        { href: "/admin/diagnosis-settings", label: "診断設定" },
        { href: "/admin/incentive-settings", label: "報酬設定" },
      ]}
    >
      {children}
    </AppShell>
  );
}
