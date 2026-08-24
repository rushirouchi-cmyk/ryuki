"use client";

import { useActionState, useState } from "react";
import { Button, Card, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";
import { REFERRAL_STATUS_LABELS } from "@/lib/utils/labels";
import { updateReferralAction, type AgentActionState } from "@/app/agent/actions";

const SELECTABLE_STATUSES = [
  "accepted",
  "declined",
  "contacted",
  "interview_scheduled",
  "interview_completed",
  "applied",
  "offer",
  "joined",
  "lost",
] as const;

export function StatusForm({
  referralId,
  currentStatus,
  offerCompany,
  offerJobTitle,
  offerSalaryYen,
  offerDate,
  joinedDate,
  notes,
}: {
  referralId: number;
  currentStatus: string;
  offerCompany: string | null;
  offerJobTitle: string | null;
  offerSalaryYen: number | null;
  offerDate: string | null;
  joinedDate: string | null;
  notes: string | null;
}) {
  const [status, setStatus] = useState(
    SELECTABLE_STATUSES.includes(currentStatus as never) ? currentStatus : "accepted",
  );
  const [state, action, pending] = useActionState<AgentActionState, FormData>(
    updateReferralAction,
    {},
  );

  const showOffer = status === "offer" || status === "joined";
  const showJoined = status === "joined";
  const showLost = status === "lost" || status === "declined";

  return (
    <Card>
      <form action={action} className="space-y-4">
        <input type="hidden" name="referralId" value={referralId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ステータス" required>
            <Select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {SELECTABLE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {REFERRAL_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {showOffer ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="内定企業" required>
              <Input name="offerCompany" defaultValue={offerCompany ?? ""} required />
            </Field>
            <Field label="ポジション">
              <Input name="offerJobTitle" defaultValue={offerJobTitle ?? ""} />
            </Field>
            <Field label="提示年収（円）" required>
              <Input
                name="offerSalaryYen"
                type="number"
                min={0}
                step={10000}
                defaultValue={offerSalaryYen ?? ""}
                required
              />
            </Field>
            <Field label="内定日">
              <Input name="offerDate" type="date" defaultValue={offerDate ?? ""} />
            </Field>
          </div>
        ) : null}

        {showJoined ? (
          <Field label="入社日" required>
            <Input name="joinedDate" type="date" defaultValue={joinedDate ?? ""} required />
          </Field>
        ) : null}

        {showLost ? (
          <Field label="終了理由">
            <Input name="lostReason" maxLength={200} />
          </Field>
        ) : null}

        <Field label="メモ">
          <Textarea name="notes" rows={3} defaultValue={notes ?? ""} maxLength={1000} />
        </Field>

        <ErrorText>{state.error}</ErrorText>
        {state.success ? <p className="text-sm text-positive">{state.success}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "更新中…" : "更新する"}
        </Button>
        <p className="text-xs text-ink-500">
          提示年収と入社日は、年収診断モデルを改善するための教師データとして蓄積されます。
        </p>
      </form>
    </Card>
  );
}
