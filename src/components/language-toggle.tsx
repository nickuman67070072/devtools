'use client';

import { Languages } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function LanguageToggle({ locale }: { locale: 'th' | 'en' }) {
  const pathname = usePathname();
  const target =
    locale === 'th'
      ? `/en${pathname === '/' ? '' : pathname}`
      : pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return (
    <a
      href={target}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d5d7d2] bg-white px-3 text-sm font-bold text-[#1c382b] hover:bg-[#f6f2e9]"
      aria-label={locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
    >
      <Languages className="size-4" aria-hidden="true" />
      {locale === 'th' ? 'EN' : 'ไทย'}
    </a>
  );
}
