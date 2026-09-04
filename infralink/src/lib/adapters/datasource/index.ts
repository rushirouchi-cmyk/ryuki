import type { TalentDataSource } from './types';
import { MockDataSource } from './mock';
import { GoogleSheetsDataSource } from './sheets';
import { PortersDataSource } from './porters';

export * from './types';
export { SHEET_NAMES } from './sheets';

/**
 * DATA_SOURCE 環境変数で取得元を切り替える (§4)。
 * アプリケーションロジックはここで解決された TalentDataSource しか触らない。
 */
export function getDataSource(kind = process.env.DATA_SOURCE ?? 'mock'): TalentDataSource {
  switch (kind.toLowerCase()) {
    case 'porters':
      return new PortersDataSource();
    case 'sheets':
      return new GoogleSheetsDataSource();
    default:
      return new MockDataSource();
  }
}

/**
 * 設定されたデータソースが使えない場合に Mock へ落とす。
 * 「外部サービス未接続でも開発を止めない」ための経路 (§42)。
 */
export async function resolveDataSource(): Promise<{
  source: TalentDataSource;
  health: { ok: boolean; detail: string };
  fellBack: boolean;
}> {
  const configured = getDataSource();
  const health = await configured.healthCheck();
  if (health.ok) return { source: configured, health, fellBack: false };
  return { source: new MockDataSource(), health, fellBack: true };
}
