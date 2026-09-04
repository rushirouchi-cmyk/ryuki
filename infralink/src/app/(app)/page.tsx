import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

/** ロールごとに最初に見るべき画面へ送る (§53)。 */
export default async function Home() {
  const user = await requireUser();
  if (user.role === 'executive' || user.role === 'admin') redirect('/dashboard/executive');
  if (user.role === 'RA') redirect('/business-development');
  redirect('/dashboard/ca');
}
