/**
 * Google Sheets / PORTERS からの取り込みを単体で実行する。
 *
 *   DATA_SOURCE=sheets npx tsx scripts/sync-sheets.ts
 *
 * 接続情報が無い場合は Mock へフォールバックし、その旨を警告として表示する (§42)。
 */
import { syncFromDataSource } from '../src/lib/sync';

async function main() {
  const result = await syncFromDataSource();
  console.log(`データソース: ${result.source}${result.fellBack ? ' (フォールバック)' : ''}`);
  console.log(
    `企業 ${result.companies} / 求人 ${result.jobs} / 候補者 ${result.candidates} / 選考 ${result.applications} / 活動 ${result.actions}`,
  );
  for (const warning of result.warnings) console.warn(`! ${warning}`);
}

main();
