import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import type { Locale } from '@/lib/i18n';

export function MeetupShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <div lang={locale}>
      <SiteHeader locale={locale} />
      {children}
      <SiteFooter locale={locale} />
    </div>
  );
}
