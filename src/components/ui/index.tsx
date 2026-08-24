import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white hover:bg-brand-700",
        secondary: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50",
        ghost: "text-ink-600 hover:bg-ink-100",
        danger: "bg-negative text-white hover:opacity-90",
        positive: "bg-positive text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-14 px-6 text-base",
        counter: "h-24 px-4 text-lg flex-col gap-1",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, full, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, full }), className)} {...props} />
  );
}

export function LinkButton({
  className,
  variant,
  size,
  full,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>) {
  return (
    <a className={cn(buttonVariants({ variant, size, full }), className)} {...props} />
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_1px_2px_rgba(21,25,34,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-sm font-semibold tracking-wide text-ink-500", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                               */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "brand";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "brand"
          ? "text-brand-600"
          : "text-ink-900";

  return (
    <div className="rounded-2xl border border-ink-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className={cn("tabular mt-1 text-2xl font-bold", toneClass)}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-400">{hint}</div> : null}
    </div>
  );
}

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-ink-100 text-ink-600",
        brand: "bg-brand-50 text-brand-700",
        positive: "bg-emerald-50 text-emerald-700",
        caution: "bg-amber-50 text-amber-700",
        negative: "bg-red-50 text-red-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function RankBadge({ rank }: { rank: string | null | undefined }) {
  if (!rank) return <Badge>—</Badge>;
  const tone =
    rank === "S" ? "brand" : rank === "A" ? "positive" : rank === "B" ? "caution" : "neutral";
  return <Badge tone={tone}>{rank}</Badge>;
}

/** Tables always scroll inside their own container, never the page body. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto rounded-2xl border border-ink-200 bg-white">
      <table className="w-full min-w-max text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-ink-200 bg-ink-50 px-3 py-2 text-left text-xs font-semibold text-ink-500",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("whitespace-nowrap border-b border-ink-100 px-3 py-2", className)}
      {...props}
    />
  );
}

export function NumTd(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <Td {...props} className={cn("tabular text-right", props.className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-ink-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label="診断の進捗"
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

const fieldClass =
  "w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "pr-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, className)} {...props} />;
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-700">
        {label}
        {required ? (
          <span className="rounded bg-red-50 px-1 text-[10px] font-bold text-red-600">
            必須
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}
