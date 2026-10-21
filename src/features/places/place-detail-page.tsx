import {
  ArrowLeft,
  Car,
  Check,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { notFound } from 'next/navigation';

import { PageShell } from '@/components/page-shell';
import { PlaceCard } from '@/components/place-card';
import { Badge } from '@/components/ui/badge';
import { PlaceCommunityActions } from '@/features/places/place-community-actions';
import { getCurrentSession } from '@/lib/auth-guards';
import { categoryDefinitions } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { googleMapsDirectionsUrl } from '@/lib/maps-url';
import { prisma } from '@/lib/prisma';
import { findNearbyPublicPlaces, getPublicPlace } from '@/lib/place-repository';
import { formatDate } from '@/lib/utils';

export async function PlaceDetailPage({ slug, locale }: { slug: string; locale: Locale }) {
  const place = await getPublicPlace(slug);
  if (!place) notFound();
  const session = await getCurrentSession();
  const favorite = session
    ? await prisma.favorite.findFirst({
        where: { userId: session.user.id, placeId: place.id, collectionId: null },
      })
    : null;
  const nearby = await findNearbyPublicPlaces(place.provinceCode, place.id);
  const th = locale === 'th';
  const name = th ? place.nameTh : place.nameEn || place.nameTh;
  const address = th ? place.addressTh : place.addressEn || place.addressTh;
  const description = th ? place.descriptionTh : place.descriptionEn || place.descriptionTh;
  const confidence = {
    HIGH: th ? 'ความมั่นใจสูง' : 'High confidence',
    MEDIUM: th ? 'ความมั่นใจปานกลาง' : 'Medium confidence',
    LOW: th ? 'ความมั่นใจต่ำ' : 'Low confidence',
  }[place.confidence];
  const openLabel = place.is24Hours
    ? th
      ? 'เปิดตลอด 24 ชั่วโมง'
      : 'Open 24 hours'
    : place.isOpenNow
      ? th
        ? 'เปิดอยู่ในขณะนี้'
        : 'Currently open'
      : th
        ? 'ตรวจสอบเวลาเปิดก่อนเดินทาง'
        : 'Check opening hours before visiting';

  return (
    <PageShell locale={locale}>
      <div className="container-shell py-8 sm:py-12">
        <a
          href={withLocale(locale, `/explore/${place.provinceSlug}`)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--forest)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {th ? 'กลับไปแผนที่' : 'Back to map'}
        </a>

        <header className="mt-7 border-b border-[var(--border)] pb-8 sm:pb-10">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--forest)]">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: place.categoryColor }}
              />
              {th ? place.categoryNameTh : place.categoryNameEn}
            </span>
            <span aria-hidden="true" className="text-[var(--border)]">
              /
            </span>
            <span className="text-[var(--text-muted)]">
              {th ? place.provinceNameTh : place.provinceNameEn}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone={place.status === 'VERIFIED' ? 'emerald' : 'coral'}>
              <ShieldCheck className="mr-1 size-3.5" aria-hidden="true" />
              {place.status === 'VERIFIED'
                ? th
                  ? 'ตรวจสอบแล้ว'
                  : 'Verified'
                : th
                  ? 'ควรตรวจสอบอีกครั้ง'
                  : 'Needs recheck'}
            </Badge>
            <Badge tone="blue">{confidence}</Badge>
          </div>
          <h1 className="mt-5 max-w-4xl [overflow-wrap:anywhere] text-4xl leading-tight font-semibold tracking-[-0.035em] text-[var(--forest)] sm:text-5xl">
            {name}
          </h1>
          <p className="mt-4 flex max-w-3xl items-start gap-2 [overflow-wrap:anywhere] leading-7 text-[var(--text-muted)]">
            <MapPin className="mt-1 size-5 shrink-0" aria-hidden="true" />
            {address}
          </p>

          <div className="relative mt-7 after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-[calc(100%-8px)] after:w-8 after:bg-gradient-to-l after:from-[var(--background)] after:to-transparent sm:after:hidden">
            <PlaceCommunityActions
              placeId={place.id}
              placeSlug={place.slug}
              locale={locale}
              signedIn={Boolean(session)}
              initialFavorite={Boolean(favorite)}
            />
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
            <div className="bg-white px-5 py-4">
              <dt className="text-xs font-semibold text-[var(--text-muted)]">
                {th ? 'คะแนนผู้ใช้' : 'Rating'}
              </dt>
              <dd className="mt-2 inline-flex items-center gap-1 text-xl font-semibold text-[#9c681c]">
                <Star className="size-5 fill-current" aria-hidden="true" />
                {place.rating.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                  ({place.reviewCount})
                </span>
              </dd>
            </div>
            <div className="bg-white px-5 py-4">
              <dt className="text-xs font-semibold text-[var(--text-muted)]">Trust score</dt>
              <dd className="mt-2 text-xl font-semibold text-[var(--forest)]">
                {place.trustScore}/100
              </dd>
            </div>
            <div className="bg-white px-5 py-4">
              <dt className="text-xs font-semibold text-[var(--text-muted)]">
                {th ? 'ตรวจสอบล่าสุด' : 'Last verified'}
              </dt>
              <dd className="mt-2 font-semibold">
                {place.lastVerifiedAt
                  ? formatDate(place.lastVerifiedAt, locale)
                  : th
                    ? 'ยังไม่มีการตรวจยืนยัน'
                    : 'Not yet verified'}
              </dd>
            </div>
          </dl>
        </header>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-12">
            <section aria-labelledby="place-about">
              <p className="eyebrow">{th ? 'รายละเอียดสถานที่' : 'Place information'}</p>
              <h2 id="place-about" className="mt-2 text-2xl font-semibold tracking-tight">
                {th ? 'เกี่ยวกับสถานที่นี้' : 'About this place'}
              </h2>
              <p className="mt-5 max-w-3xl whitespace-pre-line [overflow-wrap:anywhere] text-base leading-8 text-[var(--text-muted)]">
                {description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {place.categoryCodes.map((code) => {
                  const category = categoryDefinitions.find((item) => item.code === code);
                  return category ? (
                    <Badge key={code} tone="neutral">
                      {th ? category.nameTh : category.nameEn}
                    </Badge>
                  ) : null;
                })}
              </div>
            </section>

            {(place.rules.length > 0 || place.petTypes.length > 0) && (
              <section
                className="border-t border-[var(--border)] pt-10"
                aria-labelledby="pet-rules"
              >
                <p className="eyebrow">{th ? 'ก่อนพาสัตว์เลี้ยงเข้าใช้' : 'Before your visit'}</p>
                <h2 id="pet-rules" className="mt-2 text-2xl font-semibold tracking-tight">
                  {th ? 'กฎสำหรับสัตว์เลี้ยง' : 'Pet rules'}
                </h2>
                {place.rules.length > 0 && (
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {place.rules.map((rule) => (
                      <li
                        key={rule}
                        className="flex items-start gap-3 border-t border-[var(--border)] py-4 text-sm leading-6"
                      >
                        <Check
                          className="mt-1 size-4 shrink-0 text-[var(--forest-bright)]"
                          aria-hidden="true"
                        />
                        {rule}
                      </li>
                    ))}
                  </ul>
                )}
                {place.petTypes.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {place.petTypes.map((petType) => (
                      <Badge key={petType} tone="blue">
                        {petType}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>
            )}

            {place.amenities.length > 0 && (
              <section
                className="border-t border-[var(--border)] pt-10"
                aria-labelledby="amenities"
              >
                <p className="eyebrow">{th ? 'ความสะดวก' : 'Convenience'}</p>
                <h2 id="amenities" className="mt-2 text-2xl font-semibold tracking-tight">
                  {th ? 'สิ่งอำนวยความสะดวก' : 'Amenities'}
                </h2>
                <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {place.amenities.map((amenity, index) => (
                    <li key={amenity} className="flex items-center gap-3 text-sm font-semibold">
                      {index === 0 ? (
                        <Car className="size-4 text-[var(--forest-bright)]" aria-hidden="true" />
                      ) : (
                        <Check className="size-4 text-[var(--forest-bright)]" aria-hidden="true" />
                      )}
                      {amenity}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {nearby.length > 0 && (
              <section
                className="border-t border-[var(--border)] pt-10"
                aria-labelledby="nearby-places"
              >
                <p className="eyebrow">{th ? 'จังหวัดเดียวกัน' : 'In the same province'}</p>
                <h2 id="nearby-places" className="mt-2 text-2xl font-semibold tracking-tight">
                  {th ? 'สถานที่ใกล้เคียง' : 'Nearby places'}
                </h2>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {nearby.map((item) => (
                    <PlaceCard key={item.id} place={item} locale={locale} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section className="surface p-5" aria-labelledby="plan-visit">
              <h2 id="plan-visit" className="font-semibold">
                {th ? 'วางแผนการเดินทาง' : 'Plan your visit'}
              </h2>
              <p className="mt-4 flex items-start gap-2 text-sm font-semibold">
                <Clock3
                  className="mt-0.5 size-4 shrink-0 text-[var(--forest-bright)]"
                  aria-hidden="true"
                />
                {openLabel}
              </p>
              <div className="mt-5 grid gap-2">
                {place.phone && (
                  <a
                    href={`tel:${place.phone}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 font-semibold transition hover:bg-[var(--forest-soft)]"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    {place.phone}
                  </a>
                )}
                <a
                  href={googleMapsDirectionsUrl(place.latitude, place.longitude)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--forest)] px-4 font-semibold text-white transition hover:bg-[var(--forest-bright)]"
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  <Navigation className="size-4" aria-hidden="true" />
                  {th ? 'เปิดเส้นทาง' : 'Directions'}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
