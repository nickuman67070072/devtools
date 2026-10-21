import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--forest)]">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-[var(--terracotta)]">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[var(--text-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

const controlClass =
  'min-h-11 w-full rounded-md border border-[var(--border)] bg-white px-4 text-[var(--text)] transition placeholder:text-[#8b908d] hover:border-[#aeb9b2] focus:border-[var(--forest-bright)] disabled:bg-[var(--surface-soft)]';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-28 py-3', className)} {...props} />;
}
