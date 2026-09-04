/**
 * Prisma の datasource provider を切り替える (ADR-002)。
 *
 *   node scripts/switch-datasource.mjs postgresql
 *   node scripts/switch-datasource.mjs sqlite
 *
 * スキーマは enum / scalar list を使わず両者で互換になるよう設計しているため、
 * provider 行の書き換えだけで移行できる。切り替え後は DATABASE_URL の更新と
 * `npx prisma db push` (または migrate) が必要。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const target = process.argv[2];
if (!['sqlite', 'postgresql'].includes(target)) {
  console.error('使い方: node scripts/switch-datasource.mjs <sqlite|postgresql>');
  process.exit(1);
}

const path = 'prisma/schema.prisma';
const schema = readFileSync(path, 'utf8');
const updated = schema.replace(/provider = "(sqlite|postgresql)"/, `provider = "${target}"`);

if (updated === schema) {
  console.log(`すでに ${target} です。`);
} else {
  writeFileSync(path, updated);
  console.log(`datasource provider を ${target} に変更しました。`);
  console.log('次に .env の DATABASE_URL を更新し、npx prisma db push を実行してください。');
}
