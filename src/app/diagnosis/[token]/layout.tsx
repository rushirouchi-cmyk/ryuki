export default function DiagnosisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
