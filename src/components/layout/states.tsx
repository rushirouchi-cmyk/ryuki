export function LoadingBlock({ label = "読み込んでいます…" }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-16">
      <span
        aria-hidden
        className="h-6 w-6 animate-spin rounded-full border-2 border-ink-300 border-t-brand-500"
      />
      <p className="text-sm text-ink-500" role="status">
        {label}
      </p>
    </div>
  );
}

export function ErrorBlock({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <p className="text-lg font-bold text-ink-900">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          もう一度試す
        </button>
      ) : null}
    </div>
  );
}
