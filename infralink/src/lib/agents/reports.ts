import { prisma } from '@/lib/db';
import { notify } from '@/lib/adapters/notification';
import { ALERT_TYPE_LABELS, PHASE_LABELS, type CandidatePhase } from '@/lib/domain/enums';
import { formatDate, startOfDay } from '@/lib/domain/dates';
import { computeFunnel } from '@/lib/domain/knowledge';

/**
 * 日次 / 週次レポート生成 (§31/§32)。
 * 「情報を並べる」のではなく、AI 推奨 Action まで含めて出す (§53)。
 */

export type CaRow = {
  caId: string;
  caName: string;
  activeCandidates: number;
  todayActions: number;
  overdue: number;
  critical: number;
  applications: number;
  interviews: number;
  offers: number;
  accepted: number;
};

export type DailyReport = {
  date: Date;
  activeCandidates: number;
  normal: number;
  needsAttention: number;
  late: number;
  critical: number;
  caRows: CaRow[];
  highlights: string[];
  recommendedActions: string[];
  text: string;
};

export async function buildDailyReport(now = new Date()): Promise<DailyReport> {
  const today = startOfDay(now);

  const [candidates, alerts, users, applications] = await Promise.all([
    prisma.candidate.findMany({
      where: { status: 'active' },
      include: { ownerCa: true, actions: { where: { actionDate: { gte: today } } } },
    }),
    prisma.aiAlert.findMany({
      where: { status: { in: ['open', 'escalated'] } },
      include: { candidate: true, ca: true },
    }),
    prisma.user.findMany({ where: { active: true, role: 'CA' } }),
    prisma.application.findMany({ include: { candidate: true } }),
  ]);

  const alertsByCandidate = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    if (!alert.candidateId) continue;
    alertsByCandidate.set(alert.candidateId, [...(alertsByCandidate.get(alert.candidateId) ?? []), alert]);
  }

  const levelOf = (candidateId: string) =>
    Math.max(0, ...(alertsByCandidate.get(candidateId) ?? []).map((a) => a.alertLevel));

  const needsAttention = candidates.filter((c) => levelOf(c.id) === 1).length;
  const late = candidates.filter((c) => levelOf(c.id) === 2).length;
  const critical = candidates.filter((c) => levelOf(c.id) === 3).length;
  const normal = candidates.length - needsAttention - late - critical;

  const caRows: CaRow[] = users.map((ca) => {
    const own = candidates.filter((c) => c.ownerCaId === ca.id);
    const ownIds = new Set(own.map((c) => c.id));
    const ownApps = applications.filter((a) => ownIds.has(a.candidateId));
    return {
      caId: ca.id,
      caName: ca.name,
      activeCandidates: own.length,
      todayActions: own.reduce((s, c) => s + c.actions.length, 0),
      overdue: own.filter((c) => levelOf(c.id) >= 2).length,
      critical: own.filter((c) => levelOf(c.id) === 3).length,
      applications: ownApps.length,
      interviews: ownApps.filter((a) =>
        ['interview_1', 'interview_2', 'final', 'offer', 'accepted'].includes(a.currentStage),
      ).length,
      offers: ownApps.filter((a) => a.offerStatus === 'offered' || ['offer', 'accepted'].includes(a.currentStage)).length,
      accepted: ownApps.filter((a) => a.acceptanceStatus === 'accepted').length,
    };
  });

  // --- 重要事項: Level 3 → Level 2 の順に、超過日数が大きいものから
  const ranked = [...alerts].sort(
    (a, b) => b.alertLevel - a.alertLevel || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0),
  );
  const highlights = ranked.slice(0, 6).map((a) => {
    const overdue = a.dueAt ? Math.max(0, Math.floor((now.getTime() - a.dueAt.getTime()) / 86_400_000)) : 0;
    return `${a.candidate?.name ?? '不明'}様: ${ALERT_TYPE_LABELS[a.alertType as keyof typeof ALERT_TYPE_LABELS] ?? a.alertType}${overdue > 0 ? ` (${overdue}日超過)` : ''}`;
  });

  // --- AI 推奨 Action
  const recommendedActions: string[] = [];
  const criticalAlerts = ranked.filter((a) => a.alertLevel === 3);
  for (const alert of criticalAlerts.slice(0, 3)) {
    recommendedActions.push(
      `${alert.candidate?.name ?? ''}様を本日最優先でフォロー (${ALERT_TYPE_LABELS[alert.alertType as keyof typeof ALERT_TYPE_LABELS] ?? alert.alertType})`,
    );
  }
  const worstCa = [...caRows].sort((a, b) => b.critical - a.critical || b.overdue - a.overdue)[0];
  if (worstCa && (worstCa.critical > 0 || worstCa.overdue >= 3)) {
    recommendedActions.push(`${worstCa.caName}CAの対応状況を確認 (遅延${worstCa.overdue}件 / 重大${worstCa.critical}件)`);
  }
  const unanswered = alerts.filter((a) => a.secondNotificationAt && !a.escalatedAt).length;
  if (unanswered > 0) {
    recommendedActions.push(`AI 確認に未回答のアラートが ${unanswered} 件あります`);
  }

  const text = [
    `【${formatDate(now)} CA運用レポート】`,
    '',
    `稼働候補者: ${candidates.length}名`,
    `　正常: ${normal}名 / 要確認: ${needsAttention}名 / 遅延: ${late}名 / 重大: ${critical}名`,
    '',
    'CA別:',
    ...caRows.map(
      (r) => `　${r.caName}  稼働:${r.activeCandidates}  本日Action:${r.todayActions}  遅延:${r.overdue}  重大:${r.critical}`,
    ),
    '',
    '重要事項:',
    ...(highlights.length ? highlights.map((h) => `　・${h}`) : ['　・特筆事項なし']),
    '',
    'AI推奨Action:',
    ...(recommendedActions.length ? recommendedActions.map((a) => `　・${a}`) : ['　・なし']),
  ].join('\n');

  return { date: now, activeCandidates: candidates.length, normal, needsAttention, late, critical, caRows, highlights, recommendedActions, text };
}

export async function sendDailyReport(now = new Date()) {
  const report = await buildDailyReport(now);
  const executives = await prisma.user.findMany({
    where: { role: { in: ['executive', 'admin'] }, active: true },
  });
  for (const exec of executives) {
    await notify({
      to: exec.email,
      subject: `【日次】CA運用レポート ${formatDate(now)}`,
      body: report.text,
      refType: 'report',
      refId: 'daily',
    });
  }
  return report;
}

// -------------------------------------------------------- 週次 BD レポート

export type WeeklyBdReport = {
  generatedAt: Date;
  newProspectCount: number;
  rows: {
    rank: number;
    companyName: string;
    score: number;
    matchingCandidateCount: number;
    sRankCount: number;
    aRankCount: number;
    reason: string;
    hiringTitles: string[];
  }[];
  text: string;
};

export async function buildWeeklyBdReport(now = new Date()): Promise<WeeklyBdReport> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [opportunities, newCompanies] = await Promise.all([
    prisma.businessDevelopmentOpportunity.findMany({
      orderBy: { score: 'desc' },
      take: 10,
      include: { company: { include: { webFindings: { where: { activeStatus: 'active' } } } } },
    }),
    prisma.company.count({
      where: { transactionStatus: 'unknown', createdAt: { gte: weekAgo } },
    }),
  ]);

  const rows = opportunities.map((o, i) => ({
    rank: i + 1,
    companyName: o.company.companyName,
    score: o.score,
    matchingCandidateCount: o.matchingCandidateCount,
    sRankCount: o.sRankCount,
    aRankCount: o.aRankCount,
    reason: o.reason ?? '',
    hiringTitles: o.company.webFindings.slice(0, 3).map((f) => f.jobTitle),
  }));

  const text = [
    `【今週の新規開拓推奨 ${formatDate(now)}】`,
    '',
    `今週発見した未取引企業: ${newCompanies}社`,
    '',
    ...rows.flatMap((r) => [
      `${r.rank}位 ${r.companyName}`,
      `　Business Development Score: ${r.score}`,
      `　現在採用: ${r.hiringTitles.join(' / ') || '（公開求人未取得）'}`,
      `　当社候補者Match: ${r.matchingCandidateCount}名 (S:${r.sRankCount} / A:${r.aRankCount})`,
      `　推奨理由: ${r.reason}`,
      '',
    ]),
  ].join('\n');

  return { generatedAt: now, newProspectCount: newCompanies, rows, text };
}

export async function sendWeeklyBdReport(now = new Date()) {
  const report = await buildWeeklyBdReport(now);
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['executive', 'admin', 'RA'] }, active: true },
  });
  for (const user of recipients) {
    await notify({
      to: user.email,
      subject: `【週次】新規開拓推奨レポート ${formatDate(now)}`,
      body: report.text,
      refType: 'report',
      refId: 'weekly_bd',
    });
  }
  return report;
}

/** ダッシュボードのファネル (§24)。 */
export async function buildFunnelSnapshot() {
  const [candidates, applications] = await Promise.all([
    prisma.candidate.findMany({ where: { status: 'active' }, select: { phase: true } }),
    prisma.application.findMany(),
  ]);

  const phaseCounts = new Map<string, number>();
  for (const c of candidates) phaseCounts.set(c.phase, (phaseCounts.get(c.phase) ?? 0) + 1);

  return {
    phases: Object.entries(PHASE_LABELS).map(([key, label]) => ({
      key: key as CandidatePhase,
      label,
      count: phaseCounts.get(key) ?? 0,
    })),
    funnel: computeFunnel(applications),
  };
}
