import { Suspense } from 'react';

import { BrandLoading } from '@/components/brand-loading';
import { AuthForm } from '@/features/auth/auth-form';
import type { Locale } from '@/lib/i18n';

export function AuthPage({
  mode,
  locale,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset';
  locale: Locale;
}) {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen">
          <BrandLoading variant="fullscreen" locale={locale} />
        </main>
      }
    >
      <AuthForm mode={mode} locale={locale} />
    </Suspense>
  );
}
