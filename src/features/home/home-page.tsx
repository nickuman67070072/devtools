import { PageShell } from '@/components/page-shell';
import { HomeCategoryBrowser } from '@/features/home/home-category-browser';
import { categoryDefinitions } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import { publicPlaceStats } from '@/lib/place-repository';

export async function HomePage({ locale = 'th' }: { locale?: Locale }) {
  const stats = await publicPlaceStats();
  const th = locale === 'th';
  const categories = categoryDefinitions.map((category) => ({
    code: category.code,
    nameTh: category.nameTh,
    nameEn: category.nameEn,
    color: category.color,
    count: stats.facets[category.code] ?? 0,
  }));

  return (
    <PageShell locale={locale} variant="home">
      <div className="container-shell flex min-h-full w-full flex-col justify-center gap-3 py-3 sm:gap-5 sm:py-5">
        <section className="shrink-0 text-center">
          <p className="eyebrow mb-2">PawMap / Thailand</p>
          <h1 className="text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-bold tracking-[-0.045em] text-[var(--forest)]">
            {th ? 'ทุกที่ที่ไป' : 'Everywhere you go,'}
            <span className="ml-2 font-normal text-[var(--forest-bright)] sm:ml-3">
              {th ? 'ไปด้วยกันได้' : 'go together.'}
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            {th
              ? 'ค้นหาสถานที่ที่ต้อนรับสัตว์เลี้ยง พร้อมกฎการเข้าใช้และสถานะการตรวจสอบที่อ่านง่าย'
              : 'Find places that welcome pets, with clear entry rules and easy-to-read verification status.'}
          </p>
          <div className="mx-auto mt-3 inline-flex max-w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs text-[var(--text-muted)] shadow-[var(--shadow-sm)] sm:gap-5 sm:text-sm">
            <span>
              <strong className="text-[var(--forest)]">77</strong> {th ? 'จังหวัด' : 'provinces'}
            </span>
            <span className="h-4 w-px bg-[var(--border)]" aria-hidden="true" />
            <span>
              <strong className="text-[var(--forest)]">{stats.total.toLocaleString()}</strong>{' '}
              {th ? 'สถานที่' : 'places'}
            </span>
            <span className="hidden h-4 w-px bg-[var(--border)] sm:block" aria-hidden="true" />
            <span className="hidden sm:inline">
              {th ? 'แสดงสถานะการตรวจสอบ' : 'Verification status shown'}
            </span>
          </div>
        </section>

        <section className="shrink-0 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-soft)] p-3 sm:p-4">
          <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-3">
            <div>
              <p className="eyebrow">{th ? 'ค้นหาตามประเภท' : 'Browse by type'}</p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-2xl">
                {th ? 'สถานที่ตามหมวดหมู่' : 'Places by category'}
              </h2>
            </div>
            <p className="hidden text-xs text-[var(--text-muted)] sm:block">
              {th ? 'เลือกหมวดเพื่อเปิดแผนที่' : 'Choose a category to open the map'}
            </p>
          </div>
          <HomeCategoryBrowser categories={categories} locale={locale} />
        </section>
      </div>
    </PageShell>
  );
}
