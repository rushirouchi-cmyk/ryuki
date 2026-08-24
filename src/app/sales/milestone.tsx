import { Card } from "@/components/ui";

const INTERVIEW_BONUS_TARGET = 4;
const LEAD_BONUS_TARGET = 10;

/**
 * Shows the nearest reachable bonus condition. Targets are placeholders for the
 * MVP; the structure lets them come from `incentive_rules.conditions` later.
 */
export function NextMilestone({
  interviewCompleted,
  leadRegistered,
}: {
  interviewCompleted: number;
  leadRegistered: number;
}) {
  const remainingInterviews = INTERVIEW_BONUS_TARGET - interviewCompleted;
  const remainingLeads = LEAD_BONUS_TARGET - leadRegistered;

  const message =
    remainingInterviews > 0 && remainingInterviews <= remainingLeads
      ? `あと${remainingInterviews}件の面談着座でボーナス条件を達成します`
      : remainingLeads > 0
        ? `あと${remainingLeads}件の有効リードでボーナス条件を達成します`
        : "本日のボーナス条件は達成済みです";

  return (
    <Card className="bg-ink-900 text-white">
      <p className="text-xs font-medium text-ink-300">本日の目標</p>
      <p className="mt-1 font-semibold">{message}</p>
    </Card>
  );
}
