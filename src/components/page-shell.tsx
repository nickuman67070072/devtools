import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import type { Locale } from '@/lib/i18n';

export function PageShell({
  children,
  locale = 'th',
  variant = 'default',
}: {
  children: ReactNode;
  locale?: Locale;
  variant?: 'default' | 'home';
}) {
  const isHome = variant === 'home';
  return (
    <div
      lang={locale}
      className={isHome ? 'grid min-h-dvh grid-rows-[auto_minmax(0,1fr)_auto]' : undefined}
    >
      <SiteHeader locale={locale} />
      <main className={isHome ? 'flex min-h-0' : undefined}>{children}</main>
      <SiteFooter locale={locale} compact={isHome} />
    </div>
  );
}
