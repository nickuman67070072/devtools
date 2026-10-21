import { ShieldCheck } from 'lucide-react';

import { BrandLogo } from '@/components/brand-logo';
import type { Locale } from '@/lib/i18n';

export function SiteFooter({
  locale = 'th',
  compact = false,
}: {
  locale?: Locale;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <footer className="border-t border-[var(--border)] bg-white py-2.5 text-[var(--text-muted)]">
        <div className="container-shell flex items-center justify-between gap-3 text-[0.68rem] sm:text-xs">
          <strong className="shrink-0 text-[var(--forest)]">PawMap Thailand</strong>
          <span className="text-right">
            {locale === 'th'
              ? 'ตรวจสอบกับสถานที่ก่อนเดินทาง'
              : 'Confirm with the venue before visiting'}
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-white py-12 text-[var(--text)]">
      <div className="container-shell grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <BrandLogo />
          <p className="max-w-sm text-sm leading-7 text-[var(--text-muted)]">
            {locale === 'th'
              ? 'ค้นหาสถานที่ที่ต้อนรับสัตว์เลี้ยงทั่วประเทศไทย พร้อมกฎการเข้าใช้และสถานะการตรวจสอบที่อ่านง่าย'
              : 'Find pet-friendly places across Thailand with clear entry rules and verification status.'}
          </p>
        </div>
        <div className="space-y-3 text-sm md:justify-self-end">
          <p className="font-semibold">{locale === 'th' ? 'ก่อนเดินทาง' : 'Before visiting'}</p>
          <p className="flex gap-2 text-[var(--text-muted)]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {locale === 'th'
              ? 'โทรยืนยันกับสถานที่ก่อนเดินทางเสมอ'
              : 'Always call the venue before travelling.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
