'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { categoryDefinitions, type ProvinceSummary } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { MeetupLocationPicker, type SearchPoint } from './location-picker';
import { PlaceAutocomplete, type MeetupPlaceOption } from './place-autocomplete';

interface Card {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  memberCount: number;
  maxMembers: number;
  distanceKm: number | null;
  place: {
    nameTh: string;
    nameEn: string | null;
    provinceTh: string;
    provinceEn: string;
    categoryTh: string;
    categoryEn: string;
  };
}

export function MeetupDiscovery({ locale }: { locale: Locale }) {
  const th = locale === 'th';
  const [point, setPoint] = useState<SearchPoint | null>(null);
  const [radius, setRadius] = useState('10');
  const [customRadius, setCustomRadius] = useState('25');
  const radiusKm = Math.min(
    100,
    Math.max(0.1, Number(radius === 'custom' ? customRadius : radius) || 10),
  );
  const [province, setProvince] = useState('');
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [hasSpace, setHasSpace] = useState(false);
  const [sort, setSort] = useState<'soon' | 'latest'>('soon');
  const [queryInput, setQueryInput] = useState('');
  const [q, setQ] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<MeetupPlaceOption | null>(null);
  const placeId = selectedPlace?.id ?? '';
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    void fetch('/api/geography')
      .then((response) => response.json())
      .then((data: { provinces: ProvinceSummary[] }) => setProvinces(data.provinces))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError('');
    });
    void fetch('/api/meetups/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        ...(point ?? {}),
        radiusKm,
        province: province || undefined,
        category: category || undefined,
        placeId: placeId || undefined,
        q: q || undefined,
        date: date || undefined,
        time: time || undefined,
        hasSpace,
        sort,
        limit: 12,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('SEARCH_FAILED');
        return response.json() as Promise<{ items: Card[]; nextCursor: number | null }>;
      })
      .then((data) => {
        setItems(data.items);
        setCursor(data.nextCursor);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(cause instanceof Error ? cause.message : 'SEARCH_FAILED');
      });
    return () => controller.abort();
  }, [point, radiusKm, province, category, placeId, q, date, time, hasSpace, sort, refresh]);

  async function loadMore() {
    if (cursor === null) return;
    const response = await fetch('/api/meetups/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(point ?? {}),
        radiusKm,
        province: province || undefined,
        category: category || undefined,
        placeId: placeId || undefined,
        q: q || undefined,
        date: date || undefined,
        time: time || undefined,
        hasSpace,
        sort,
        cursor,
        limit: 12,
      }),
    });
    if (!response.ok) {
      setError('SEARCH_FAILED');
      return;
    }
    const data = (await response.json()) as { items: Card[]; nextCursor: number | null };
    setItems((current) => [...current, ...data.items]);
    setCursor(data.nextCursor);
  }

  return (
    <main className="container-shell py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">PawMap Social</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {th ? 'นัดเจอเพื่อนรักสัตว์' : 'Social Meetups'}
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            {th ? 'ค้นหากิจกรรมที่จัด ณ สถานที่ใน PawMap' : 'Find activities at PawMap places.'}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
            href={withLocale(locale, '/my-meetups')}
          >
            {th ? 'Meetup ของฉัน' : 'My Meetups'}
          </a>
          <a
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--forest)] px-4 text-sm font-semibold text-white"
            href={withLocale(locale, '/meetups/new')}
          >
            {th ? 'สร้าง Meetup' : 'Create Meetup'}
          </a>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <MeetupLocationPicker locale={locale} value={point} onChange={setPoint} />
          <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4">
            <label className="grid gap-1 text-sm font-semibold">
              {th ? 'รัศมีค้นหา' : 'Search radius'}
              <Select value={radius} onChange={(event) => setRadius(event.target.value)}>
                {['1', '3', '5', '10', '20', '50'].map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
                <option value="custom">
                  {th ? 'กำหนดเอง (สูงสุด 100 กม.)' : 'Custom (up to 100 km)'}
                </option>
              </Select>
            </label>
            {radius === 'custom' && (
              <label className="grid gap-1 text-sm font-semibold">
                {th ? 'ระยะที่ต้องการ (กม.)' : 'Distance (km)'}
                <Input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={customRadius}
                  onChange={(event) => setCustomRadius(event.target.value)}
                  onBlur={() =>
                    setCustomRadius(
                      String(Math.min(100, Math.max(0.1, Number(customRadius) || 10))),
                    )
                  }
                />
              </label>
            )}
            <label className="grid gap-1 text-sm font-semibold">
              {th ? 'จังหวัด' : 'Province'}
              <Select value={province} onChange={(event) => setProvince(event.target.value)}>
                <option value="">{th ? 'ทุกจังหวัด' : 'All provinces'}</option>
                {provinces.map((item) => (
                  <option key={item.code} value={item.code}>
                    {th ? item.nameTh : item.nameEn}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              {th ? 'หมวดหมู่สถานที่' : 'Place category'}
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{th ? 'ทุกหมวดหมู่' : 'All categories'}</option>
                {categoryDefinitions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {th ? item.nameTh : item.nameEn}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              {th ? 'วันที่' : 'Date'}
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              {th ? 'ตั้งแต่เวลา' : 'From time'}
              <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
            <PlaceAutocomplete
              id="meetup-place-search"
              locale={locale}
              selectedPlace={selectedPlace}
              onSelect={setSelectedPlace}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasSpace}
                onChange={(event) => setHasSpace(event.target.checked)}
              />
              {th ? 'เฉพาะที่ยังมีที่ว่าง' : 'Only meetups with space'}
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              {th ? 'เรียงตาม' : 'Sort by'}
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as 'soon' | 'latest')}
              >
                <option value="soon">{th ? 'กำลังจะเริ่ม' : 'Starting soon'}</option>
                <option value="latest">{th ? 'สร้างล่าสุด' : 'Newest'}</option>
              </Select>
            </label>
          </div>
        </aside>
        <section aria-live="polite">
          <h2 className="mb-4 text-xl font-semibold">
            {th ? 'กิจกรรมที่พบ' : 'Meetups'} {items.length > 0 && `(${items.length})`}
          </h2>
          <form
            className="mb-5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQ(queryInput.trim());
            }}
          >
            <Input
              value={queryInput}
              onChange={(event) => {
                setQueryInput(event.target.value);
                if (!event.target.value.trim()) setQ('');
              }}
              aria-label={th ? 'ค้นหากิจกรรมหรือสถานที่' : 'Search meetups or places'}
              placeholder={th ? 'ชื่อกิจกรรมหรือสถานที่' : 'Meetup or place name'}
            />
            <Button type="submit">{th ? 'ค้นหา' : 'Search'}</Button>
          </form>
          {loading ? (
            <p role="status">{th ? 'กำลังค้นหา…' : 'Searching…'}</p>
          ) : error ? (
            <div role="alert" className="rounded-xl border p-5">
              <p>{th ? 'โหลด Meetup ไม่สำเร็จ' : 'Could not load meetups'}</p>
              <Button className="mt-3" onClick={() => setRefresh((current) => current + 1)}>
                {th ? 'ลองใหม่' : 'Retry'}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-xl border bg-white p-6 text-[var(--text-muted)]">
              {th ? 'ยังไม่มี Meetup ที่ตรงกับเงื่อนไข' : 'No meetups match these filters.'}
            </p>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--forest)] sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-[var(--surface-soft)] px-2 py-3 text-[var(--forest)]">
                    <strong className="text-2xl leading-none">
                      {new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Bangkok',
                        day: '2-digit',
                      }).format(new Date(item.startsAt))}
                    </strong>
                    <span className="mt-1 text-xs font-semibold uppercase">
                      {new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
                        timeZone: 'Asia/Bangkok',
                        month: 'short',
                      }).format(new Date(item.startsAt))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--forest)]">
                      {th ? item.place.categoryTh : item.place.categoryEn} · {item.status}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {th ? item.place.nameTh : item.place.nameEn || item.place.nameTh} ·{' '}
                      {th ? item.place.provinceTh : item.place.provinceEn}
                    </p>
                    <p className="mt-2 text-sm">
                      {new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
                        timeZone: 'Asia/Bangkok',
                        timeStyle: 'short',
                      }).format(new Date(item.startsAt))}
                      {' · '}
                      {item.memberCount}/{item.maxMembers} {th ? 'คน' : 'members'}
                      {item.distanceKm !== null && ` · ${item.distanceKm} km`}
                    </p>
                  </div>
                  <a
                    href={withLocale(locale, `/meetups/${item.id}`)}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-[var(--forest)] px-4 text-sm font-semibold text-[var(--forest)] hover:bg-[var(--forest-soft)]"
                  >
                    {th ? 'ดูรายละเอียด' : 'View details'}
                  </a>
                </article>
              ))}
            </div>
          )}
          {cursor !== null && !loading && (
            <Button variant="secondary" className="mt-6" onClick={() => void loadMore()}>
              {th ? 'ดูเพิ่มเติม' : 'Load more'}
            </Button>
          )}
        </section>
      </div>
    </main>
  );
}
