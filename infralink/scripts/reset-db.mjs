/**
 * 開発用 DB リセット。
 *
 * prisma db push --force-reset は本番 DB に対して実行されると破壊的なため使わない。
 * ローカルの SQLite ファイルを削除してからスキーマを適用する方式にしている。
 * PostgreSQL を使う場合はこのスクリプトではなく、対象 DB を明示して
 * `npx prisma migrate reset` を「開発 DB であることを確認した上で」実行すること。
 */
import { existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Prisma CLI と同じく .env を読み込む (npm script 経由では自動ロードされないため)。
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const url = process.env.DATABASE_URL ?? '';
if (!url.startsWith('file:')) {
  console.error(
    'reset-db は SQLite (DATABASE_URL="file:...") 専用です。\n' +
      'PostgreSQL の場合は対象が開発用 DB であることを確認のうえ、手動で prisma migrate reset を実行してください。',
  );
  process.exit(1);
}

const path = new URL(url.replace(/^file:/, ''), `file://${process.cwd()}/prisma/`).pathname;
if (existsSync(path)) {
  rmSync(path);
  console.log(`削除しました: ${path}`);
}
execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
