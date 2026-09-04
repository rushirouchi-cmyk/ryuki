import type { SlaRule, SlaSettings } from '@/lib/settings';
import { addBusinessDays, addHours } from './dates';
import type { AlertLevel, AlertType, CandidatePhase } from './enums';
import { ALERT_TYPE_LABELS } from './enums';

/**
 * フェーズ別 SLA 判定 (§6/§7)。
 *
 * 「3日更新がない」といった一律判定ではなく、フェーズごとに
 *   起点 (anchor) — いつから数えるか
 *   充足条件 (satisfied) — 何をしたら解消か
 * を定義し、SLA 設定 (時間・レベル) と組み合わせて期限を出す。
 */

export type SlaCandidate = {
  id: string;
  name: string;
  phase: string;
  /** S / A は重要候補者として扱い、複数日放置で重大扱いに引き上げる (§7)。 */
  rank: string | null;
  ownerCaId: string | null;
  createdAt: Date;
  lastContactDate: Date | null;
  nextAction: string | null;
  nextActionDate: Date | null;
};

export type SlaAction = {
  actionType: string;
  actionDate: Date;
};

export type SlaApplication = {
  currentStage: string;
  applicationDate: Date;
  documentResult: string | null;
  offerDeadline: Date | null;
};

export type SlaContext = {
  candidate: SlaCandidate;
  /** actionDate の降順。 */
  actions: SlaAction[];
  applications: SlaApplication[];
  now: Date;
};

export type SlaFinding = {
  alertType: AlertType;
  level: AlertLevel;
  dueAt: Date;
  overdueHours: number;
  reason: string;
  ruleLabel: string;
};

type Resolution = {
  /** 期限計算の起点。null なら判定対象外。 */
  anchor: Date | null;
  /** 条件を満たしているか。true なら未アラート。 */
  satisfied: boolean;
  /** 期限を anchor + rule.hours ではなく明示指定したい場合 (面接対策など)。 */
  explicitDue?: Date | null;
  detail: string;
};

const latest = (actions: SlaAction[], types: string[]) =>
  actions.find((a) => types.includes(a.actionType))?.actionDate ?? null;

const existsAfter = (actions: SlaAction[], types: string[], anchor: Date) =>
  actions.some((a) => types.includes(a.actionType) && a.actionDate.getTime() >= anchor.getTime());

const RESOLVERS: Record<AlertType, (ctx: SlaContext) => Resolution> = {
  interview_not_scheduled: ({ candidate, actions }) => {
    const anchor = latest(actions, ['call', 'mail']) ?? candidate.lastContactDate ?? candidate.createdAt;
    const scheduled = Boolean(candidate.nextActionDate);
    return {
      anchor,
      satisfied: scheduled && candidate.nextActionDate! > anchor,
      detail: scheduled ? '面談日時が設定済み' : '面談希望を取得済みだが日時が未設定',
    };
  },

  jobs_not_proposed: ({ candidate, actions }) => {
    const anchor = latest(actions, ['meeting']) ?? candidate.lastContactDate;
    if (!anchor) return { anchor: null, satisfied: true, detail: '面談実施記録なし' };
    return {
      anchor,
      satisfied: existsAfter(actions, ['job_proposal'], anchor),
      detail: '面談後に求人提案の記録がない',
    };
  },

  intent_not_confirmed: ({ actions }) => {
    const anchor = latest(actions, ['job_proposal']);
    if (!anchor) return { anchor: null, satisfied: true, detail: '求人提案の記録なし' };
    return {
      anchor,
      satisfied: existsAfter(actions, ['intent_check', 'recommend'], anchor),
      detail: '求人提案後に意向確認の記録がない',
    };
  },

  not_recommended: ({ actions, applications }) => {
    const anchor = latest(actions, ['intent_check']);
    if (!anchor) return { anchor: null, satisfied: true, detail: '応募意思確認の記録なし' };
    const recommended =
      existsAfter(actions, ['recommend'], anchor) ||
      applications.some((a) => a.applicationDate.getTime() >= anchor.getTime());
    return { anchor, satisfied: recommended, detail: '応募意思ありだが企業推薦の記録がない' };
  },

  screening_stalled: ({ applications }) => {
    const pending = applications
      .filter((a) => a.currentStage === 'document_screening' && (a.documentResult ?? 'pending') === 'pending')
      .sort((a, b) => a.applicationDate.getTime() - b.applicationDate.getTime())[0];
    if (!pending) return { anchor: null, satisfied: true, detail: '書類選考中の応募なし' };
    return { anchor: pending.applicationDate, satisfied: false, detail: '書類選考の企業回答が長期間未取得' };
  },

  interview_prep_missing: ({ candidate, actions }) => {
    const interviewDate = candidate.nextActionDate;
    const anchor = latest(actions, ['recommend', 'interview_prep']) ?? candidate.lastContactDate;
    if (!interviewDate) {
      return { anchor: null, satisfied: true, detail: '面接日時が未設定 (別途アラート対象)' };
    }
    const prepared = anchor ? existsAfter(actions, ['interview_prep'], anchor) : false;
    return {
      anchor: anchor ?? candidate.createdAt,
      satisfied: prepared,
      // 面接の n 時間前が期限。
      explicitDue: interviewDate,
      detail: '面接予定に対し面接対策の記録がない',
    };
  },

  interview_feedback_missing: ({ actions, candidate }) => {
    const anchor = latest(actions, ['interview_prep', 'recommend']) ?? candidate.lastContactDate;
    if (!anchor) return { anchor: null, satisfied: true, detail: '面接記録なし' };
    return {
      anchor,
      satisfied: existsAfter(actions, ['interview_feedback'], anchor),
      detail: '面接後の候補者所感が未回収',
    };
  },

  offer_follow_missing: ({ actions, candidate }) => {
    // 内定フェーズは「最後のフォローからの経過時間」を毎回見る (§6 最重要)。
    const anchor = latest(actions, ['offer_follow']) ?? candidate.lastContactDate ?? candidate.createdAt;
    return { anchor, satisfied: false, detail: '内定者フォローの最終記録からの経過時間が SLA を超過' };
  },

  hold_recontact_due: ({ candidate }) => {
    if (!candidate.nextActionDate) {
      // 保留は必ず次回接触予定日を持つべき (§6)。未設定自体を即時アラートにする。
      return { anchor: candidate.createdAt, satisfied: false, explicitDue: candidate.createdAt, detail: '保留中だが次回接触予定日が未設定' };
    }
    return {
      anchor: candidate.nextActionDate,
      satisfied: false,
      explicitDue: candidate.nextActionDate,
      detail: '保留中の再接触予定日を超過',
    };
  },

  next_action_overdue: ({ candidate }) => {
    if (!candidate.nextActionDate) return { anchor: null, satisfied: true, detail: '次回アクション未設定' };
    return {
      anchor: candidate.nextActionDate,
      satisfied: false,
      explicitDue: candidate.nextActionDate,
      detail: `次回アクション「${candidate.nextAction ?? '未記入'}」の予定日を超過`,
    };
  },

  // CA 未回答は SLA ではなくエスカレーション制御側 (agents/ca-supervisor) で生成する。
  ca_no_response: () => ({ anchor: null, satisfied: true, detail: '' }),
};

function dueFrom(rule: SlaRule, anchor: Date, explicitDue?: Date | null) {
  if (explicitDue) {
    // 面接対策のように「イベントの n 時間前」が期限になるケース。
    return rule.alertType === 'interview_prep_missing'
      ? addHours(explicitDue, -rule.hours)
      : explicitDue;
  }
  return rule.businessDays
    ? addBusinessDays(anchor, Math.max(1, Math.round(rule.hours / 24)))
    : addHours(anchor, rule.hours);
}

/**
 * 期限超過の度合いに応じてレベルを決める。
 *
 * Level 3 (重大) は §7 の定義に限定する。ルール自体が level 3 のもの
 * (内定者フォロー / 推薦未実施 / 面接対策未実施) と、
 * 「重要候補者 (S/A ランク) を複数日放置」だけが 3 に上がる。
 * ここを緩くすると全件が重大になり優先順位が機能しなくなる。
 */
const CRITICAL_NEGLECT_HOURS = 72;

function resolveLevel(
  rule: SlaRule,
  overdueHours: number,
  warnRatio: number,
  rank: string | null,
): AlertLevel | null {
  if (overdueHours > 0) {
    const isImportant = rank === 'S' || rank === 'A';
    const neglected = overdueHours >= CRITICAL_NEGLECT_HOURS;
    const escalated = isImportant && neglected ? Math.min(3, rule.level + 1) : rule.level;
    return escalated as AlertLevel;
  }
  const elapsedRatio = rule.hours > 0 ? (rule.hours + overdueHours) / rule.hours : 1;
  return elapsedRatio >= warnRatio ? 1 : null;
}

/** 1 候補者について、期限が近い/超過しているチェックを返す。 */
export function evaluateSla(ctx: SlaContext, settings: SlaSettings): SlaFinding[] {
  const phase = ctx.candidate.phase as CandidatePhase;
  const rules = settings.rules[phase] ?? [];
  // フェーズ固有ルールに加え、共通の「次回アクション期日超過」も常に評価する。
  const allRules: SlaRule[] = [
    ...rules,
    ...(phase === 'on_hold' || phase === 'closed'
      ? []
      : [
          {
            alertType: 'next_action_overdue' as AlertType,
            hours: 0,
            level: 2 as const,
            businessDays: false,
            label: '次回アクション予定日を超過',
          },
        ]),
  ];

  const findings: SlaFinding[] = [];
  for (const rule of allRules) {
    const resolver = RESOLVERS[rule.alertType];
    if (!resolver) continue;
    const resolution = resolver(ctx);
    if (!resolution.anchor || resolution.satisfied) continue;

    const dueAt = dueFrom(rule, resolution.anchor, resolution.explicitDue);
    const overdueHours = (ctx.now.getTime() - dueAt.getTime()) / 3600_000;
    const level = resolveLevel(rule, overdueHours, settings.warnRatio, ctx.candidate.rank);
    if (level === null) continue;

    findings.push({
      alertType: rule.alertType,
      level,
      dueAt,
      overdueHours: Math.max(0, Math.round(overdueHours * 10) / 10),
      reason: `${ALERT_TYPE_LABELS[rule.alertType]}: ${resolution.detail}`,
      ruleLabel: rule.label,
    });
  }

  // 同一候補者内では重い順に並べ、重複する意味のアラートは最上位のみ扱いやすくする。
  return findings.sort((a, b) => b.level - a.level || b.overdueHours - a.overdueHours);
}
