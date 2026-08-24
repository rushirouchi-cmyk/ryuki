"use client";

import { useEffect } from "react";
import { ErrorBlock } from "@/components/layout/states";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* The digest is the server-side correlation id; the message may contain
     * details that should not reach the browser console in production. */
    console.error("route error", error.digest);
  }, [error]);

  return (
    <ErrorBlock
      title="画面を表示できませんでした"
      description="一時的な問題の可能性があります。もう一度お試しいただくか、時間をおいてアクセスしてください。"
      onRetry={reset}
    />
  );
}
