'use client';

import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-white text-ink-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-ink-700 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'w-full px-5 py-4 text-base',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SubmitButton({
  children,
  pendingLabel = '送信中...',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: 'sm' | 'md' | 'lg';
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-xs text-rose-600">必須</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
        className,
      )}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={clsx(
        'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Chip({
  selected,
  children,
  onClick,
  disabled,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={clsx(
        'rounded-full border px-4 py-2.5 text-sm font-medium transition-colors',
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-ink-700 hover:border-brand-400 hover:bg-brand-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  );
}

export function OptionButton({
  selected,
  children,
  onClick,
  sub,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  sub?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
          : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40',
      )}
    >
      <span>
        <span className="block text-base font-medium text-ink-900">{children}</span>
        {sub && <span className="mt-0.5 block text-xs text-ink-500">{sub}</span>}
      </span>
      <span
        className={clsx(
          'ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300',
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
    </button>
  );
}
