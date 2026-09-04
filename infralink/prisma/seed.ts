/**
 * デモデータ投入 (§42/§43)。
 *
 *   npm run seed          既存データを保持したまま upsert
 *   npm run db:reset      DB を作り直してから投入
 *
 * ユーザーの初期パスワードは環境変数 SEED_PASSWORD で変更できる。
 * 本番環境では必ず変更すること (SECURITY.md 参照)。
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEMO_USERS } from '../src/lib/demo/fixtures';
import { syncFromDataSource } from '../src/lib/sync';
import { MockDataSource } from '../src/lib/adapters/datasource/mock';
import { refreshAllMatches } from '../src/lib/agents/matching';
import { researchForCandidate } from '../src/lib/agents/market-research';
import { runBusinessDevelopmentRanking } from '../src/lib/agents/business-development';
import { runCandidateMonitor } from '../src/lib/agents/ca-supervisor';
import { suggestTagByRule } from '../src/lib/agents/rejection-tagging';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD ?? 'infralink2026';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('1/6 ユーザーを作成しています...');
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash },
      update: { name: user.name, role: user.role, active: true },
    });
  }

  console.log('2/6 デモデータを同期しています (Mock データソース)...');
  const sync = await syncFromDataSource(new MockDataSource());
  console.log(
    `    企業 ${sync.companies} / 求人 ${sync.jobs} / 候補者 ${sync.candidates} / 選考 ${sync.applications} / 活動 ${sync.actions}`,
  );
  for (const warning of sync.warnings) console.warn(`    ! ${warning}`);

  console.log('3/6 見送り理由のタグ候補を付与しています...');
  const rejected = await prisma.application.findMany({
    where: { rejectionReasonOriginal: { not: null }, rejectionReasonTag: null },
  });
  for (const app of rejected) {
    const suggestion = suggestTagByRule(app.rejectionReasonOriginal!);
    await prisma.application.update({
      where: { id: app.id },
      // 原文は保持したまま、AI 提案タグのみ設定する。確定者は未設定 (人が確定する)。
      data: { rejectionReasonTag: suggestion.tag },
    });
  }

  console.log('4/6 求人マッチングを計算しています (Matching Agent)...');
  const matches = await refreshAllMatches();
  console.log(`    候補者 ${matches.candidates} 名 / マッチ ${matches.matches} 件`);

  console.log('5/6 WEB 市場調査と新規開拓スコアを計算しています...');
  const targets = await prisma.candidate.findMany({
    where: { rank: { in: ['S', 'A'] } },
    select: { id: true },
    take: 6,
  });
  for (const target of targets) await researchForCandidate(target.id, 6);
  const bd = await runBusinessDevelopmentRanking();
  console.log(`    開拓候補企業 ${bd.evaluated} 社を評価しました`);

  console.log('6/6 CA Supervisor Agent を実行しています...');
  const monitor = await runCandidateMonitor();
  console.log(
    `    チェック ${monitor.candidatesChecked} 名 / 新規アラート ${monitor.alertsCreated} 件 (重大 ${monitor.criticalCount} 件)`,
  );

  console.log('\n完了しました。ログイン情報:');
  for (const user of DEMO_USERS) console.log(`  ${user.email} / ${password}  (${user.role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
