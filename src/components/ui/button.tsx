import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-[var(--forest)] text-white hover:bg-[var(--forest-bright)]',
        variant === 'secondary' &&
          'border border-[var(--border)] bg-white text-[var(--forest)] hover:bg-[var(--forest-soft)]',
        variant === 'ghost' && 'bg-transparent text-[var(--forest)] hover:bg-[var(--surface-soft)]',
        variant === 'danger' && 'bg-[var(--terracotta)] text-white hover:bg-[#9f2f2b]',
        size === 'sm' && 'min-h-9 px-4 text-sm',
        size === 'md' && 'min-h-11 px-5 text-sm',
        size === 'lg' && 'min-h-13 px-7 text-base',
        className,
      )}
      {...props}
    />
  );
}
