"use client";

import { Button } from "@/components/ui";
import { confirmRevenueAction, updateLedgerStatusAction } from "@/app/admin/actions";

export function LedgerActions() {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="submit" formAction={updateLedgerStatusAction} name="status" value="approved">
        選択を承認
      </Button>
      <Button
        type="submit"
        variant="secondary"
        formAction={updateLedgerStatusAction}
        name="status"
        value="rejected"
      >
        選択を却下
      </Button>
      <Button
        type="submit"
        variant="secondary"
        formAction={updateLedgerStatusAction}
        name="status"
        value="paid"
      >
        選択を支払済みに
      </Button>
    </div>
  );
}

export function RevenueActions() {
  return (
    <div className="mt-3">
      <Button type="submit" formAction={confirmRevenueAction} variant="positive">
        選択した売上を確定
      </Button>
    </div>
  );
}
