import { NextResponse } from 'next/server';
import { runJob, type JobName } from '@/app/actions/settings';

/**
 * 定期実行エンドポイント (§52)。
 *
 * 外部スケジューラ (Vercel Cron / cloud scheduler / systemd timer 等) から
 *   POST /api/cron/monitor
 *   Authorization: Bearer $CRON_SECRET
 * のように呼び出す。実行時刻そのものは管理画面の設定値をスケジューラ側に反映する運用とする。
 */

const JOBS: JobName[] = [
  'sync',
  'monitor',
  'escalation',
  'matching',
  'market_research',
  'bd_ranking',
  'daily_report',
  'weekly_bd_report',
];

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  // シークレット未設定の本番運用は許可しない (開発時のみ素通し)。
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request, context: { params: Promise<{ job: string }> }) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { job } = await context.params;
  if (!JOBS.includes(job as JobName)) {
    return NextResponse.json({ error: 'unknown job', available: JOBS }, { status: 400 });
  }
  const result = await runJob(job as JobName);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
