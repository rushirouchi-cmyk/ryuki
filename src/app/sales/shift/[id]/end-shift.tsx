"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { endShiftAction } from "../../actions";

export function EndShiftButton({ shiftId }: { shiftId: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("この営業シフトを終了しますか？QRコードは無効になります。")) {
          return;
        }
        const formData = new FormData();
        formData.set("shiftId", String(shiftId));
        startTransition(() => endShiftAction(formData));
      }}
    >
      {pending ? "終了中…" : "営業を終了"}
    </Button>
  );
}
