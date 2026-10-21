'use client';

import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Input } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface MeetupPlaceOption {
  id: string;
  slug?: string;
  nameTh: string;
  nameEn: string | null;
  addressTh?: string;
  province?: { nameTh: string; nameEn: string };
  category?: { nameTh: string; nameEn: string };
}

interface Props {
  id?: string;
  locale: Locale;
  label?: string;
  selectedPlace: MeetupPlaceOption | null;
  onSelect: (place: MeetupPlaceOption | null) => void;
  required?: boolean;
  className?: string;
}

export function PlaceAutocomplete({
  id,
  locale,
  label,
  selectedPlace,
  onSelect,
  required = false,
  className,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? `meetup-place-${generatedId}`;
  const listId = `${inputId}-suggestions`;
  const th = locale === 'th';
  const localizedName = (place: MeetupPlaceOption) =>
    th ? place.nameTh : place.nameEn || place.nameTh;
  const [query, setQuery] = useState(selectedPlace ? localizedName(selectedPlace) : '');
  const [items, setItems] = useState<MeetupPlaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, MeetupPlaceOption[]>());

  useEffect(() => {
    if (selectedPlace) queueMicrotask(() => setQuery(localizedName(selectedPlace)));
    // The parent owns selection; typing is intentionally kept when it clears it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace?.id, locale]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || (selectedPlace && value === localizedName(selectedPlace))) {
      queueMicrotask(() => {
        setItems([]);
        setLoading(false);
        setError(false);
        setOpen(false);
        setActiveIndex(-1);
      });
      return;
    }
    const cacheKey = `${locale}:${value.toLocaleLowerCase(locale)}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      queueMicrotask(() => {
        setItems(cached);
        setLoading(false);
        setError(false);
        setOpen(true);
        setActiveIndex(cached.length ? 0 : -1);
      });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      setOpen(true);
      void fetch(`/api/meetups/places?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('PLACE_SEARCH_FAILED');
          return response.json() as Promise<{ items: MeetupPlaceOption[] }>;
        })
        .then((data) => {
          const suggestions = data.items.slice(0, 10);
          cache.current.set(cacheKey, suggestions);
          setItems(suggestions);
          setActiveIndex(suggestions.length ? 0 : -1);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setItems([]);
          setActiveIndex(-1);
          setLoading(false);
          setError(true);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // retry deliberately repeats the same query after an error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, retry, locale, selectedPlace?.id]);

  function choose(place: MeetupPlaceOption) {
    setQuery(localizedName(place));
    setItems([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(place);
  }

  function clear() {
    setQuery('');
    setItems([]);
    setOpen(false);
    setError(false);
    setActiveIndex(-1);
    onSelect(null);
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label ?? (th ? 'ค้นหาสถานที่' : 'Find a place')}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-3.5 left-3.5 z-10 size-4 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-required={required}
          autoComplete="off"
          value={query}
          placeholder={th ? 'พิมพ์ชื่อสถานที่หรือที่อยู่' : 'Type a place name or address'}
          className="pr-11 pl-10"
          onFocus={() => {
            if (items.length || loading || error) setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setActiveIndex(-1);
            if (selectedPlace) onSelect(null);
            if (!value.trim()) {
              setItems([]);
              setOpen(false);
              setError(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.min(items.length - 1, current + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => Math.max(0, current - 1));
            } else if (event.key === 'Enter' && open && activeIndex >= 0 && items[activeIndex]) {
              event.preventDefault();
              choose(items[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
              setActiveIndex(-1);
            } else if (event.key === 'Tab') setOpen(false);
          }}
        />
        {(query || selectedPlace) && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
            aria-label={th ? 'ล้างสถานที่' : 'Clear place'}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {open && (
          <div
            id={listId}
            role="listbox"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-lg)]"
          >
            {loading ? (
              <p
                role="status"
                className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--text-muted)]"
              >
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                {th ? 'กำลังค้นหา…' : 'Searching…'}
              </p>
            ) : error ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 px-3 py-3 text-sm"
              >
                <span>{th ? 'ค้นหาไม่สำเร็จ' : 'Search failed'}</span>
                <button
                  type="button"
                  className="font-semibold text-[var(--forest)] underline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setRetry((value) => value + 1)}
                >
                  {th ? 'ลองใหม่' : 'Retry'}
                </button>
              </div>
            ) : items.length ? (
              items.map((place, index) => (
                <button
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  type="button"
                  key={place.id}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition',
                    index === activeIndex
                      ? 'bg-[var(--forest-soft)]'
                      : 'hover:bg-[var(--surface-soft)]',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(place)}
                >
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-[var(--forest-bright)]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">{localizedName(place)}</strong>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {[
                        place.addressTh,
                        th ? place.province?.nameTh : place.province?.nameEn,
                        th ? place.category?.nameTh : place.category?.nameEn,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-[var(--text-muted)]">
                {th ? 'ไม่พบสถานที่ที่อนุมัติแล้ว' : 'No approved places found'}
              </p>
            )}
          </div>
        )}
      </div>
      {selectedPlace && (
        <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--forest-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[var(--forest-bright)] uppercase">
              {th ? 'สถานที่ที่เลือก' : 'Selected place'}
            </p>
            <p className="mt-1 font-semibold">{localizedName(selectedPlace)}</p>
            {(selectedPlace.addressTh || selectedPlace.province) && (
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                {[
                  selectedPlace.addressTh,
                  th ? selectedPlace.province?.nameTh : selectedPlace.province?.nameEn,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--forest)] hover:bg-white"
          >
            {th ? 'เปลี่ยน' : 'Change'}
          </button>
        </div>
      )}
      {!selectedPlace && query.trim().length === 1 && (
        <p className="text-xs text-[var(--text-muted)]">
          {th ? 'พิมพ์อย่างน้อย 2 ตัวอักษร' : 'Type at least 2 characters'}
        </p>
      )}
    </div>
  );
}
