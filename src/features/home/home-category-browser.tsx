'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

interface HomeCategory {
  code: string;
  nameTh: string;
  nameEn: string;
  color: string;
  count: number;
}

const MOBILE_PAGE_SIZE = 8;

export function HomeCategoryBrowser({
  categories,
  locale,
}: {
  categories: HomeCategory[];
  locale: Locale;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(categories.length / MOBILE_PAGE_SIZE));
  const pageStart = page * MOBILE_PAGE_SIZE;
  const isThai = locale === 'th';

  return (
    <div>
      <div
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2"
        aria-label={isThai ? 'หมวดหมู่สถานที่' : 'Place categories'}
      >
        {categories.map((category, index) => {
          const visibleOnMobile = index >= pageStart && index < pageStart + MOBILE_PAGE_SIZE;
          return (
            <a
              key={category.code}
              href={`${withLocale(locale, '/explore')}?categories=${category.code}`}
              className={`${visibleOnMobile ? 'flex' : 'hidden'} group min-h-13 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-left transition hover:border-[var(--forest-bright)] hover:bg-[var(--forest-soft)] sm:flex sm:min-h-15 sm:px-4`}
            >
              <span className="flex min-w-0 items-center gap-2 text-[0.76rem] leading-4 font-semibold text-[var(--forest)] sm:text-sm">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                <span>{isThai ? category.nameTh : category.nameEn}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                {category.count.toLocaleString(isThai ? 'th-TH' : 'en-US')}
              </span>
            </a>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="mt-2.5 flex items-center justify-between sm:hidden">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="inline-grid size-9 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--forest)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={isThai ? 'หมวดหมู่ก่อนหน้า' : 'Previous categories'}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2" aria-live="polite">
            {Array.from({ length: pageCount }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all ${index === page ? 'w-5 bg-[var(--forest)]' : 'w-1.5 bg-[var(--border)]'}`}
                aria-hidden="true"
              />
            ))}
            <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">
              {isThai ? `หน้า ${page + 1} จาก ${pageCount}` : `Page ${page + 1} of ${pageCount}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={page === pageCount - 1}
            className="inline-grid size-9 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--forest)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={isThai ? 'หมวดหมู่ถัดไป' : 'Next categories'}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
