import { Clock3, ExternalLink, MapPin, Navigation, Phone, ShieldCheck, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { PlaceSummary } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { googleMapsDirectionsUrl } from '@/lib/maps-url';

export function PlacePreview({ place, locale }: { place: PlaceSummary; locale: Locale }) {
  const name = locale === 'th' ? place.nameTh : place.nameEn;
  const address = locale === 'th' ? place.addressTh : place.addressEn;
  return (
    <article className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-xs font-semibold text-[var(--forest)]">
        <span className="size-2 rounded-full" style={{ backgroundColor: place.categoryColor }} />
        {locale === 'th' ? place.categoryNameTh : place.categoryNameEn}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone={place.status === 'VERIFIED' ? 'emerald' : 'coral'}>
              <ShieldCheck className="mr-1 size-3.5" aria-hidden="true" />
              {place.status === 'VERIFIED'
                ? locale === 'th'
                  ? 'ตรวจสอบแล้ว'
                  : 'Verified'
                : locale === 'th'
                  ? 'ควรตรวจสอบอีกครั้ง'
                  : 'Needs recheck'}
            </Badge>
            <Badge tone="blue">{place.confidence} confidence</Badge>
          </div>
          <h2 className="text-lg font-semibold leading-snug">{name}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[#5e6561]">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {address}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="inline-flex items-center gap-1 text-[#9b6718]">
            <Star className="size-4 fill-current" aria-hidden="true" /> {place.rating.toFixed(1)}
            <span className="font-normal text-[#5e6561]">({place.reviewCount})</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[#42606c]">
            <Clock3 className="size-4" aria-hidden="true" />
            {place.is24Hours ? '24 ชั่วโมง' : place.isOpenNow ? 'เปิดอยู่' : 'ปิดอยู่'}
          </span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <a
            href={`tel:${place.phone}`}
            className="grid size-11 place-items-center rounded-md border border-[var(--border)] hover:bg-[var(--surface-soft)]"
            aria-label={`${locale === 'th' ? 'โทร' : 'Call'} ${name}`}
          >
            <Phone className="size-4" aria-hidden="true" />
          </a>
          <a
            href={withLocale(locale, `/places/${place.slug}`)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--forest)] px-4 text-sm font-semibold text-white hover:bg-[var(--forest-bright)]"
          >
            <Navigation className="size-4" aria-hidden="true" />
            {locale === 'th' ? 'ดูรายละเอียด' : 'View details'}
          </a>
          <a
            href={googleMapsDirectionsUrl(place.latitude, place.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-[var(--forest)] hover:bg-[var(--surface-soft)]"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {locale === 'th' ? 'เปิดใน Google Maps' : 'Open in Google Maps'}
          </a>
        </div>
      </div>
    </article>
  );
}
