'use client';

import { Navigation, Phone, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { PlaceSummary } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { googleMapsDirectionsUrl } from '@/lib/maps-url';

export function EmergencyList({ places, locale }: { places: PlaceSummary[]; locale: Locale }) {
  const isThai = locale === 'th';
  return (
    <div className="grid gap-4">
      {places.map((place, index) => (
        <article
          key={place.id}
          className="surface flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center"
        >
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fae0e2] font-black text-[#c23934]">
              {index + 1}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black">{isThai ? place.nameTh : place.nameEn}</h2>
                <Badge tone="red">24h</Badge>
              </div>
              <p className="mt-1 text-sm text-[#5e6561]">
                {isThai ? place.addressTh : place.addressEn}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#2d5a43]">
                <ShieldAlert className="size-4" />
                {place.confidence} confidence · {place.trustScore}/100
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`tel:${place.phone}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#e1b9bd] px-5 text-sm font-bold text-[#9a2c34]"
            >
              <Phone className="size-4" />
              {isThai ? 'โทร' : 'Call'}
            </a>
            <a
              href={googleMapsDirectionsUrl(place.latitude, place.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#c23934] px-5 text-sm font-bold text-white"
            >
              <Navigation className="size-4" />
              {isThai ? 'นำทาง' : 'Directions'}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
