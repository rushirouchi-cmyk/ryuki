/**
 * CLI から定期ジョブを実行する (§52)。
 *
 *   npx tsx scripts/run-agents.ts monitor
 *   npx tsx scripts/run-agents.ts sync matching bd_ranking
 *
 * cron / systemd timer から呼ぶ場合はこのスクリプト、
 * サーバーレス環境では /api/cron/[job] を使う。
 */
import { runJob, type JobName } from '../src/app/actions/settings';

const AVAILABLE: JobName[] = [
  'sync',
  'monitor',
  'escalation',
  'matching',
  'market_research',
  'bd_ranking',
  'daily_report',
  'weekly_bd_report',
];

async function main() {
  const requested = process.argv.slice(2) as JobName[];
  if (requested.length === 0) {
    console.log(`使い方: npx tsx scripts/run-agents.ts <job...>\n実行可能なジョブ: ${AVAILABLE.join(', ')}`);
    return;
  }

  for (const job of requested) {
    if (!AVAILABLE.includes(job)) {
      console.error(`未知のジョブ: ${job}`);
      process.exitCode = 1;
      continue;
    }
    const result = await runJob(job);
    console.log(`[${job}] ${result.ok ? 'OK' : 'FAILED'} — ${result.summary}`);
    if (!result.ok) process.exitCode = 1;
  }
}

main();
