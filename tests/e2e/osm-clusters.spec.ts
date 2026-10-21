import { expect, test, type Page } from '@playwright/test';
import type { MapPoint, PlaceSummary } from '../../src/lib/domain';
import type { ConstructionHouse } from '../../src/features/map/map-types';

const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
function point(index: number, longitude = 100.8): MapPoint {
  return {
    id: 'point-' + index,
    slug: 'point-' + index,
    nameTh: 'สถานที่ ' + index,
    nameEn: 'Place ' + index,
    latitude: 13.2,
    longitude,
    provinceCode: '10',
    categoryCode: 'CAFE',
    categoryCodes: ['CAFE'],
    categoryColor: '#38795b',
  };
}
function detail(item: MapPoint): PlaceSummary {
  return {
    ...item,
    descriptionTh: 'รายละเอียดทดสอบ',
    descriptionEn: 'Test details',
    addressTh: 'ที่อยู่ทดสอบ',
    addressEn: 'Test address',
    provinceSlug: 'bangkok',
    provinceNameTh: 'กรุงเทพมหานคร',
    provinceNameEn: 'Bangkok',
    districtNameTh: '',
    districtNameEn: '',
    categoryNameTh: 'คาเฟ่',
    categoryNameEn: 'Cafe',
    rating: 0,
    reviewCount: 0,
    status: 'STALE',
    confidence: 'LOW',
    trustScore: 0,
    lastVerifiedAt: null,
    isOpenNow: false,
    is24Hours: false,
    phone: '',
    petTypes: [],
    rules: [],
    amenities: [],
  };
}
async function fixture(page: Page, points: MapPoint[]) {
  const state = {
    fail: false,
    maps: 0,
    stats: 0,
    glb: 0,
    details: 0,
    delayFirst: false,
    privateHouses: [] as ConstructionHouse[],
    privateWait: Promise.resolve(),
    privateFail: false,
    missingLabels: [] as string[],
    queries: [] as string[],
  };
  await page.addInitScript(() => sessionStorage.setItem('pawmap:intro-seen:v1', '1'));
  page.on('request', (request) => {
    if (request.url().endsWith('.glb')) state.glb++;
  });
  page.on('console', (message) => {
    if (/Image "pawmap-count-.*could not be loaded/u.test(message.text()))
      state.missingLabels.push(message.text());
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: tile }),
  );
  await page.route('**/api/places/map?*', async (route) => {
    state.maps++;
    if (state.fail) return route.fulfill({ status: 503, json: { error: 'test failure' } });
    const params = new URL(route.request().url()).searchParams;
    state.queries.push(params.toString());
    const cursor = Number(params.get('cursor') ?? 0);
    const selected = params.get('q') === 'none' ? [] : points;
    const rows = selected.slice(cursor, cursor + 750);
    await route.fulfill({
      json: {
        type: 'FeatureCollection',
        features: rows.map((item) => ({
          type: 'Feature',
          id: item.id,
          geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
          properties: params.get('detail') === 'compact' ? item : detail(item),
        })),
        nextCursor: cursor + 750 < selected.length ? cursor + 750 : null,
        total: selected.length,
        facets: { CAFE: selected.length },
      },
    });
  });
  await page.route('**/api/places/province-stats?*', (route) => {
    state.stats++;
    return route.fulfill({
      json: {
        total: points.length,
        provinces: { '10': points.length },
        facets: { CAFE: points.length },
      },
    });
  });
  await page.route('**/api/submissions/map?*', async (route) => {
    await state.privateWait;
    if (state.privateFail) return route.fulfill({ status: 503, json: { error: 'unavailable' } });
    return state.privateHouses.length
      ? route.fulfill({ json: { houses: state.privateHouses } })
      : route.fulfill({ status: 401, json: { error: 'unauthorized' } });
  });
  await page.route(/\/api\/places\/point-\d+$/u, async (route) => {
    state.details++;
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    if (state.delayFirst && id === 'point-0')
      await new Promise((resolve) => setTimeout(resolve, 500));
    const found = points.find((item) => item.id === id);
    await route
      .fulfill({ status: found ? 200 : 404, json: found ? detail(found) : { error: 'NOT_FOUND' } })
      .catch(() => {});
  });
  return state;
}
test('3201 places use individual GPU markers, paged lists, stable refresh and retained data on errors', async ({
  page,
}) => {
  test.setTimeout(60000);
  const state = await fixture(
    page,
    Array.from({ length: 3201 }, (_, index) => point(index)),
  );
  await page.goto('/explore?view=osm');
  const map = page.getByLabel('แผนที่ถนนประเทศไทย');
  await expect(map).toHaveAttribute('data-osm-rendered-points', '3201');
  expect(await page.locator('.pawmap-osm-marker').count()).toBe(0);
  expect(await page.getByRole('button', { includeHidden: true }).count()).toBeLessThan(180);
  // Development Strict Mode can replay (and abort) the initial effect once.
  // Totals must not be recalculated for each of the five marker pages.
  expect(state.stats).toBeLessThanOrEqual(2);
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  const group = page.getByLabel('สถานที่พิกัดเดียวกัน');
  await expect(group.getByText('3201 สถานที่ตรงจุดนี้', { exact: true })).toBeVisible();
  expect(await group.getByRole('button').count()).toBeLessThanOrEqual(53);
  await group.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'เลือกสถานที่' }).click();
  const list = page.locator('details').filter({ hasText: 'เลือกสถานที่' });
  await expect(list.getByRole('button', { name: 'สถานที่ 0', exact: true })).toBeVisible();
  await list.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(list.getByRole('button', { name: 'สถานที่ 50', exact: true })).toBeVisible();
  await list.getByRole('button', { name: 'สถานที่ 50', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'สถานที่ 50', exact: true })).toBeVisible();
  const updates = await map.getAttribute('data-osm-source-updates');
  const previous = state.maps;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state.maps).toBeGreaterThanOrEqual(previous + 5);
  await page.waitForTimeout(500);
  expect(await map.getAttribute('data-osm-source-updates')).toBe(updates);
  state.fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/รีเฟรชไม่สำเร็จ กำลังแสดงข้อมูลล่าสุด/u)).toBeVisible();
  await expect(map).toHaveAttribute('data-osm-rendered-points', '3201');
  state.fail = false;
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(page.getByText(/รีเฟรชไม่สำเร็จ กำลังแสดงข้อมูลล่าสุด/u)).toHaveCount(0);
  expect(state.glb).toBe(0);
  expect(state.missingLabels).toEqual([]);
  await page.screenshot({ path: 'test-results/osm-cluster-3201.png', fullPage: true });
});

test('public markers render even when the private endpoint is delayed or unavailable', async ({
  page,
}) => {
  const state = await fixture(page, [point(0)]);
  let release = () => {};
  state.privateWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.privateFail = true;
  await page.goto('/en/explore?view=osm');
  const map = page.getByLabel('Street map of Thailand');
  try {
    await expect(map).toHaveAttribute('data-osm-rendered-points', '1');
  } finally {
    release();
  }
  await expect(page.getByText(/Cannot refresh private places/u)).toBeVisible();
  await expect(map).toHaveAttribute('data-osm-rendered-points', '1');
  state.privateFail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText(/Cannot refresh private places/u)).toHaveCount(0);
});

test('private markers disappear from an open group when access is revoked', async ({ page }) => {
  const state = await fixture(page, [point(0)]);
  state.privateHouses = [
    {
      ...point(99),
      id: 'private-99',
      nameTh: 'Pending private place',
      nameEn: 'Pending private place',
      href: '/my-submissions/private-99',
      status: 'PENDING',
    },
  ];
  await page.goto('/en/explore?view=osm');
  const map = page.getByLabel('Street map of Thailand');
  await expect(map).toHaveAttribute('data-osm-rendered-points', '2');
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(page.getByRole('link', { name: /Pending private place/u }).first()).toBeVisible();
  state.privateHouses = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(map).toHaveAttribute('data-osm-rendered-points', '1');
  await expect(page.getByRole('link', { name: /Pending private place/u })).toHaveCount(0);
});

test('hidden tabs pause polling and refresh once on return without resetting the camera', async ({
  page,
}) => {
  const state = await fixture(page, [point(0)]);
  await page.clock.install();
  await page.goto('/en/explore?view=osm');
  const map = page.getByLabel('Street map of Thailand');
  await expect(map).toHaveAttribute('data-osm-rendered-points', '1');
  const zoom = await map.getAttribute('data-osm-zoom');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const requests = state.maps;
  await page.clock.fastForward(31000);
  expect(state.maps).toBe(requests);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect.poll(() => state.maps).toBe(requests + 1);
  await page.waitForTimeout(400);
  expect(state.maps).toBe(requests + 1);
  expect(await map.getAttribute('data-osm-zoom')).toBe(zoom);
});
test('overlapping individual markers open a picker without zooming; 3D pauses in OSM', async ({
  page,
}) => {
  await fixture(page, [point(0, 100.75), point(1, 100.85)]);
  await page.goto('/explore?view=osm');
  const map = page.getByLabel('แผนที่ถนนประเทศไทย');
  await expect(map).toHaveAttribute('data-osm-rendered-points', '2');
  const zoom = Number(await map.getAttribute('data-osm-zoom'));
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(page.getByLabel('สถานที่พิกัดเดียวกัน')).toBeVisible();
  expect(Number(await map.getAttribute('data-osm-zoom'))).toBe(zoom);
  await page.getByRole('button', { name: 'ไทย 3D', exact: true }).click();
  const model = page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ');
  await expect(model).toHaveAttribute('data-model-ready', 'true', { timeout: 30000 });
  await page.getByRole('button', { name: 'แผนที่ถนน', exact: true }).click();
  await expect(model).toHaveAttribute('data-model-active', 'false');
});
test('a URL-selected place outside the viewport loads details and rapid clicks cannot replace the latest selection', async ({
  page,
}) => {
  const state = await fixture(page, [point(0), point(1)]);
  state.delayFirst = true;
  await page.goto('/en/explore?view=osm&q=none&place=point-1');
  await expect(page.getByRole('heading', { name: 'Place 1', exact: true })).toBeVisible();
  await page.goto('/en/explore?view=osm');
  await page.locator('summary').filter({ hasText: 'Select a place' }).click();
  const list = page.locator('details').filter({ hasText: 'Select a place' });
  await list.getByRole('button', { name: 'Place 0', exact: true }).click();
  await list.getByRole('button', { name: 'Place 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Place 1', exact: true })).toBeVisible();
  await page.waitForTimeout(650);
  await expect(page.getByRole('heading', { name: 'Place 0', exact: true })).toHaveCount(0);
});

test('filters, bbox loading and camera survive view switching and browser history', async ({
  page,
}) => {
  const state = await fixture(page, [point(0), point(1)]);
  await page.goto('/en/explore?view=osm&categories=CAFE&q=none');
  const map = page.getByLabel('Street map of Thailand');
  await expect(map).toHaveAttribute('data-osm-rendered-points', '0');
  const search = page.getByRole('textbox', { name: 'Search places', exact: true });
  await search.fill('');
  await search.press('Enter');
  await expect(map).toHaveAttribute('data-osm-rendered-points', '2');
  await expect(page).not.toHaveURL(/q=none/u);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect
    .poll(async () => Number(await map.getAttribute('data-osm-zoom')))
    .toBeGreaterThan(4.8);
  await page.waitForTimeout(500);
  const zoom = await map.getAttribute('data-osm-zoom');
  await page.getByRole('button', { name: 'Thailand 3D', exact: true }).click();
  await expect(page).not.toHaveURL(/view=osm/u);
  await page.goBack();
  await expect(page).toHaveURL(/view=osm/u);
  await expect(page).toHaveURL(/categories=CAFE/u);
  await expect(map).toBeVisible();
  expect(await map.getAttribute('data-osm-zoom')).toBe(zoom);
  const compact = state.queries
    .map((query) => new URLSearchParams(query))
    .filter((params) => params.get('detail') === 'compact');
  expect(compact.length).toBeGreaterThan(0);
  expect(compact.every((params) => params.get('bbox')?.split(',').length === 4)).toBe(true);
});
