'use client';
import { loadMapGeography } from './map-geography';

import { Box, Filter, Map as MapIcon, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import {
  categoryDefinitions,
  type CategoryCode,
  type MapFilters,
  type PlaceSummary,
  type ProvinceSummary,
  type DistrictSummary,
} from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { parseExploreUrl, type ExploreMapView, type ExploreUrlState } from '@/lib/explore-url';
import { cn } from '@/lib/utils';
import { MapCanvas } from '@/features/map/map-canvas';
import { PlacePreview } from '@/features/map/place-preview';

interface GeographyResponse {
  provinces: ProvinceSummary[];
  districts: DistrictSummary[];
}

export function ExploreShell({
  locale,
  initialState,
}: {
  locale: Locale;
  initialState?: ExploreUrlState;
}) {
  const [geography, setGeography] = useState<GeographyResponse>({ provinces: [], districts: [] });
  const [filters, setFilters] = useState<MapFilters>(initialState?.filters ?? {});
  const [view, setView] = useState<ExploreMapView>(initialState?.view ?? '3d');
  const [osmActivated, setOsmActivated] = useState(initialState?.view === 'osm');
  const [queryInput, setQueryInput] = useState(initialState?.filters.query ?? '');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSummary | null>(null);
  const [requestedPlaceSlug, setRequestedPlaceSlug] = useState(initialState?.selectedPlaceSlug);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

  useEffect(() => {
    void loadMapGeography()
      .then(setGeography)
      .catch(() => {});
  }, []);

  const selectedProvince = useMemo(
    () =>
      geography.provinces.find(
        (province) => province.code === filters.province || province.slug === filters.province,
      ),
    [filters.province, geography.provinces],
  );

  useEffect(() => {
    if (!selectedProvince) return;
    void fetch(`/api/geography?province=${selectedProvince.code}`)
      .then((response) => response.json() as Promise<GeographyResponse>)
      .then((data) => setGeography((current) => ({ ...current, districts: data.districts })));
  }, [selectedProvince]);
  const visibleDistricts = selectedProvince ? geography.districts : [];

  const handleResults = useCallback((nextTotal: number, nextFacets: Record<string, number>) => {
    setTotal(nextTotal);
    setFacets(nextFacets);
  }, []);

  const handlePlaceSelect = useCallback((place: PlaceSummary | null) => {
    setSelectedPlace(place);
    setRequestedPlaceSlug(undefined);
  }, []);

  const handleProvinceSelect = useCallback(
    (province: { code: string; slug: string }) => {
      setFilters((current) => ({ ...current, province: province.code, district: undefined }));
      setSelectedPlace(null);
      setRequestedPlaceSlug(undefined);
      const prefix = locale === 'en' ? '/en' : '';
      window.history.pushState({}, '', `${prefix}/explore/${province.slug}`);
    },
    [locale],
  );

  function toggleCategory(code: CategoryCode) {
    setFilters((current) => {
      const categories = new Set(current.categories ?? []);
      if (categories.has(code)) categories.delete(code);
      else categories.add(code);
      return { ...current, categories: [...categories] };
    });
  }

  function clearFilters() {
    setQueryInput('');
    setFilters({});
    setSelectedPlace(null);
    setRequestedPlaceSlug(undefined);
    window.history.pushState({}, '', withLocale(locale, '/explore'));
  }

  useEffect(() => {
    if (filters.province && !selectedProvince) return;
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.district) params.set('district', filters.district);
    if (filters.categories?.length) params.set('categories', filters.categories.join(','));
    if (view === 'osm') params.set('view', 'osm');
    const selectedSlug = selectedPlace?.slug ?? requestedPlaceSlug;
    if (selectedSlug) params.set('place', selectedSlug);
    const path = withLocale(
      locale,
      selectedProvince ? `/explore/${selectedProvince.slug}` : '/explore',
    );
    window.history.replaceState({}, '', `${path}${params.size ? `?${params}` : ''}`);
  }, [filters, locale, requestedPlaceSlug, selectedPlace?.slug, selectedProvince, view]);

  useEffect(() => {
    const restoreFromUrl = () => {
      const province = window.location.pathname.match(/\/explore\/([^/?]+)/u)?.[1];
      const restored = parseExploreUrl(new URLSearchParams(window.location.search), province);
      setFilters(restored.filters);
      setQueryInput(restored.filters.query ?? '');
      setSelectedPlace(null);
      setRequestedPlaceSlug(restored.selectedPlaceSlug);
      setView(restored.view);
      if (restored.view === 'osm') setOsmActivated(true);
    };
    window.addEventListener('popstate', restoreFromUrl);
    return () => window.removeEventListener('popstate', restoreFromUrl);
  }, []);

  const sidebar = (
    <div className="space-y-5 p-5">
      <div>
        <p className="eyebrow">{locale === 'th' ? 'ค้นหาทั่วไทย' : 'Search Thailand'}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {locale === 'th' ? 'ที่ไหนดีสำหรับเพื่อนตัวโปรด' : 'Find their next favourite place'}
        </h1>
      </div>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, query: queryInput.trim() || undefined }));
        }}
      >
        <Search className="absolute top-3.5 left-3.5 size-4 text-[#5e6561]" aria-hidden="true" />
        <Input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          className="pr-20 pl-10"
          placeholder={locale === 'th' ? 'ชื่อสถานที่ อำเภอ จังหวัด' : 'Place, district, province'}
          aria-label={locale === 'th' ? 'ค้นหาสถานที่' : 'Search places'}
        />
        <button
          type="submit"
          className="absolute top-1.5 right-1.5 min-h-8 rounded-lg bg-[#2d5a43] px-3 text-xs font-bold text-white"
        >
          {locale === 'th' ? 'ค้นหา' : 'Go'}
        </button>
      </form>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm font-bold">
          {locale === 'th' ? 'จังหวัด' : 'Province'}
          <Select
            value={selectedProvince?.code ?? ''}
            onChange={(event) => {
              const province = geography.provinces.find((item) => item.code === event.target.value);
              setGeography((current) => ({ ...current, districts: [] }));
              setFilters((current) => ({
                ...current,
                province: province?.code,
                district: undefined,
              }));
              if (province)
                window.history.pushState({}, '', withLocale(locale, `/explore/${province.slug}`));
              else window.history.pushState({}, '', withLocale(locale, '/explore'));
            }}
          >
            <option value="">{locale === 'th' ? 'ทุกจังหวัด (77)' : 'All provinces (77)'}</option>
            {geography.provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {locale === 'th' ? province.nameTh : province.nameEn}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          {locale === 'th' ? 'อำเภอ / เขต' : 'District'}
          <Select
            value={filters.district ?? ''}
            disabled={!selectedProvince}
            onChange={(event) =>
              setFilters((current) => ({ ...current, district: event.target.value || undefined }))
            }
          >
            <option value="">{locale === 'th' ? 'ทุกอำเภอ' : 'All districts'}</option>
            {visibleDistricts.map((district) => (
              <option key={district.code} value={district.nameEn}>
                {locale === 'th' ? district.nameTh : district.nameEn}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">{locale === 'th' ? 'หมวดหมู่' : 'Categories'}</p>
          <Badge tone="neutral">
            {total} {locale === 'th' ? 'แห่ง' : 'places'}
          </Badge>
        </div>
        <input
          aria-label={locale === 'th' ? 'ค้นหาหมวดหมู่' : 'Search categories'}
          placeholder={locale === 'th' ? 'ค้นหาหมวดหมู่' : 'Search categories'}
          value={categoryQuery}
          onChange={(event) => setCategoryQuery(event.target.value)}
          className="mb-3 w-full rounded-lg border p-2 text-sm"
        />
        <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
          {categoryDefinitions
            .filter((category) =>
              `${category.nameTh} ${category.nameEn}`
                .toLowerCase()
                .includes(categoryQuery.trim().toLowerCase()),
            )
            .map((category) => {
              const active = filters.categories?.includes(category.code);
              return (
                <button
                  key={category.code}
                  onClick={() => toggleCategory(category.code)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition',
                    active
                      ? 'border-[#2d5a43] bg-[#e7efe9] text-[#1c382b]'
                      : 'border-[#d9e1dc] bg-white hover:border-[#8db8a9]',
                  )}
                  aria-pressed={active}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {locale === 'th' ? category.nameTh : category.nameEn}
                  {facets[category.code] !== undefined && (
                    <span className="text-[10px]">{facets[category.code]}</span>
                  )}
                </button>
              );
            })}
        </div>
      </div>
      <button
        onClick={clearFilters}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
      >
        <X className="size-4" aria-hidden="true" />{' '}
        {locale === 'th' ? 'ล้างตัวกรองทั้งหมด' : 'Clear all filters'}
      </button>
    </div>
  );

  return (
    <div
      lang={locale}
      className="relative h-[calc(100vh-80px)] min-h-[650px] overflow-hidden bg-white lg:grid lg:grid-cols-[420px_1fr]"
    >
      <aside className="hidden overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] lg:block">
        {sidebar}
      </aside>
      <section className="relative h-full min-h-0">
        <MapCanvas
          locale={locale}
          filters={filters}
          onPlaceSelect={handlePlaceSelect}
          onProvinceSelect={handleProvinceSelect}
          onResults={handleResults}
          selectedPlaceSlug={requestedPlaceSlug}
          view={view}
          osmActivated={osmActivated}
        />
        <div
          className="absolute top-16 left-1/2 z-30 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 rounded-md border border-[var(--border)] bg-white p-1 lg:top-4"
          role="group"
          aria-label={locale === 'th' ? 'เลือกโหมดแผนที่' : 'Choose map view'}
        >
          {(
            [
              ['3d', Box, locale === 'th' ? 'ไทย 3D' : 'Thailand 3D'],
              ['osm', MapIcon, locale === 'th' ? 'แผนที่ถนน' : 'Street map'],
            ] as const
          ).map(([nextView, Icon, label]) => (
            <button
              key={nextView}
              type="button"
              aria-pressed={view === nextView}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition sm:px-4',
                view === nextView
                  ? 'bg-[var(--forest)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--forest-soft)]',
              )}
              onClick={() => {
                if (nextView === view) return;
                setView(nextView);
                if (nextView === 'osm') setOsmActivated(true);
                const url = new URL(window.location.href);
                if (nextView === 'osm') url.searchParams.set('view', 'osm');
                else url.searchParams.delete('view');
                window.history.pushState({}, '', `${url.pathname}${url.search}`);
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="absolute top-4 right-16 left-4 z-20 flex gap-2 lg:hidden">
          <form
            className="relative flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({ ...current, query: queryInput.trim() || undefined }));
            }}
          >
            <Search className="absolute top-3 left-3 size-4 text-[#5e6561]" aria-hidden="true" />
            <Input
              className="rounded-full bg-white pl-9 shadow-xl"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder={locale === 'th' ? 'ค้นหาสถานที่' : 'Search places'}
            />
          </form>
          <button
            onClick={() => setFiltersOpen(true)}
            className="grid size-11 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-white"
            aria-label={locale === 'th' ? 'เปิดตัวกรอง' : 'Open filters'}
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </button>
        </div>
        {selectedPlace && (
          <div className="absolute right-4 bottom-6 z-20 w-[min(350px,calc(100%-32px))]">
            <button
              onClick={() => setSelectedPlace(null)}
              className="absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-md bg-white"
              aria-label={locale === 'th' ? 'ปิดข้อมูลสถานที่' : 'Close place preview'}
            >
              <X className="size-4" />
            </button>
            <PlacePreview place={selectedPlace} locale={locale} />
          </div>
        )}
      </section>
      {filtersOpen && (
        <div
          className="fixed inset-0 z-[70] bg-[color:rgb(24_28_26_/_35%)] lg:hidden"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="explore-filter-panel absolute right-0 bottom-0 left-0 max-h-[86vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--background)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-5 py-4">
              <p className="flex items-center gap-2 font-extrabold">
                <Filter className="size-5" /> {locale === 'th' ? 'ตัวกรอง' : 'Filters'}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)}>
                {locale === 'th' ? 'เสร็จสิ้น' : 'Done'}
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
