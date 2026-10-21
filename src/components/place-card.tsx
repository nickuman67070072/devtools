import { ArrowUpRight, Clock3, MapPin, ShieldCheck, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { PlaceSummary } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

export function PlaceCard({ place, locale = 'th' }: { place: PlaceSummary; locale?: Locale }) {
  return (
    <article className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 transition hover:border-[var(--forest-bright)]">
      <div className="mb-5 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--forest)]">
          <span className="size-2 rounded-full" style={{ backgroundColor: place.categoryColor }} />
          {locale === 'th' ? place.categoryNameTh : place.categoryNameEn}
        </span>
        <span>{locale === 'th' ? place.provinceNameTh : place.provinceNameEn}</span>
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone={place.status === 'VERIFIED' ? 'emerald' : 'coral'}>
              <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
              {place.status === 'VERIFIED'
                ? locale === 'th'
                  ? 'ตรวจสอบแล้ว'
                  : 'Verified'
                : locale === 'th'
                  ? 'ควรตรวจสอบอีกครั้ง'
                  : 'Needs recheck'}
            </Badge>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">
            {locale === 'th' ? place.nameTh : place.nameEn}
          </h3>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--text-muted)]">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            {locale === 'th' ? place.addressTh : place.addressEn}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm">
          <div className="flex gap-4">
            <span className="inline-flex items-center gap-1 font-bold text-[#9a681e]">
              <Star className="size-4 fill-current" />
              {place.rating.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
              <Clock3 className="size-4" />
              {place.is24Hours
                ? '24h'
                : place.isOpenNow
                  ? locale === 'th'
                    ? 'เปิดอยู่'
                    : 'Open'
                  : locale === 'th'
                    ? 'ปิด'
                    : 'Closed'}
            </span>
          </div>
          <a
            href={withLocale(locale, `/places/${place.slug}`)}
            className="grid size-10 place-items-center rounded-md border border-[var(--border)] text-[var(--forest)] group-hover:bg-[var(--forest)] group-hover:text-white"
            aria-label={locale === 'th' ? `ดู ${place.nameTh}` : `View ${place.nameEn}`}
          >
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
