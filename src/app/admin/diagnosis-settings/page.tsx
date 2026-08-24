import { Alert, Card } from '@/components/ui';
import { requireAdmin } from '@/server/guards';
import { getAnalyticsConfig, getDiagnosisConfig } from '@/server/settings';
import { AnalyticsConfigForm, DiagnosisConfigForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function DiagnosisSettingsPage() {
  await requireAdmin();
  const [diagnosisConfig, analyticsConfig] = await Promise.all([
    getDiagnosisConfig(),
    getAnalyticsConfig(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink-900">診断・分析設定</h1>
        <p className="text-xs text-ink-500">
          年収診断エンジンとArea Scoreの重み・閾値。値はコードではなく app_settings に保存されます。
        </p>
      </div>

      <Alert tone="info">
        設定を変更しても過去の診断結果は書き換わりません。各診断は算出時の設定スナップショットを保持しています。
      </Alert>

      <Card title="年収診断エンジン">
        <DiagnosisConfigForm config={diagnosisConfig} />
      </Card>

      <Card title="Area Score・ユニットエコノミクス">
        <AnalyticsConfigForm config={analyticsConfig} />
      </Card>
    </div>
  );
}
