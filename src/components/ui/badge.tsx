import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Badge({
  children,
  tone = 'emerald',
  className,
}: {
  children: ReactNode;
  tone?: 'emerald' | 'coral' | 'red' | 'blue' | 'neutral';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold',
        tone === 'emerald' && 'bg-[var(--forest-soft)] text-[var(--forest)]',
        tone === 'coral' && 'bg-[#f9e9df] text-[#88412f]',
        tone === 'red' && 'bg-[var(--terracotta-soft)] text-[#922e2a]',
        tone === 'blue' && 'bg-[#e7efec] text-[#34594a]',
        tone === 'neutral' && 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
