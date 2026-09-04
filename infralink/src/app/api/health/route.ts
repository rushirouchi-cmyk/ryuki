import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveDataSource } from '@/lib/adapters/datasource';
import { getAiProvider } from '@/lib/adapters/ai';
import { getSearchProvider } from '@/lib/adapters/search';
import { getNotificationProvider } from '@/lib/adapters/notification';

/** 各アダプタの状態を返す。監視・障害切り分け用。 */
export async function GET() {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = error instanceof Error ? error.message : 'error';
  }

  const dataSource = await resolveDataSource();

  return NextResponse.json({
    database,
    dataSource: { configured: process.env.DATA_SOURCE ?? 'mock', active: dataSource.source.name, detail: dataSource.health.detail },
    ai: { provider: getAiProvider().name, model: getAiProvider().model },
    search: getSearchProvider().name,
    notification: getNotificationProvider().name,
  });
}
