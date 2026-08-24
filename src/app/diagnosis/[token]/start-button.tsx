"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { startDiagnosisAction } from "./actions";

export function StartButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      full
      disabled={pending}
      onClick={() => startTransition(() => startDiagnosisAction(token))}
    >
      {pending ? "準備しています…" : "無料で年収診断をはじめる"}
    </Button>
  );
}
