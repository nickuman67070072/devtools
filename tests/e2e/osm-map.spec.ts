import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const tilePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('OSM is lazy-loaded and markers link to Google only after user interaction', async ({
  page,
}) => {
  let osmRequests = 0;
  let googleRequests = 0;
  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    osmRequests += 1;
    await route.fulfill({ status: 200, contentType: 'image/png', body: tilePng });
  });
  await page.route('https://www.google.com/**', async (route) => {
    googleRequests += 1;
    await route.abort();
  });

  await page.goto('/explore');
  await expect(page.getByRole('button', { name: 'ไทย 3D' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(osmRequests).toBe(0);
  expect(googleRequests).toBe(0);

  await page.getByRole('button', { name: 'แผนที่ถนน' }).click();
  await expect(page).toHaveURL(/view=osm/u);
  await expect(page.getByLabel('แผนที่ถนนประเทศไทย')).toHaveAttribute('data-osm-ready', 'true', {
    timeout: 20000,
  });
  await expect.poll(() => osmRequests).toBeGreaterThan(0);
  expect(googleRequests).toBe(0);

  await page.locator('summary').filter({ hasText: 'เลือกสถานที่' }).click();
  const marker = page
    .locator('details')
    .filter({ hasText: 'เลือกสถานที่' })
    .getByRole('button')
    .first();
  await expect(marker).toBeVisible({ timeout: 15000 });
  await marker.click();
  const googleLink = page.getByRole('link', { name: 'เปิดใน Google Maps' });
  await expect(googleLink).toHaveAttribute('href', /www\.google\.com\/maps\/dir/u);
  await expect(googleLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(googleLink).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(googleRequests).toBe(0);

  await page.getByRole('button', { name: 'ไทย 3D' }).click();
  await expect(page).not.toHaveURL(/view=osm/u);
  await expect(page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ')).toHaveAttribute(
    'data-model-ready',
    'true',
  );
});

test('OSM provider failure falls back to local province boundaries', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/explore?view=osm');
  const map = page.getByLabel('แผนที่ถนนประเทศไทย');
  await expect(map).toHaveAttribute('data-osm-fallback', 'true', { timeout: 20000 });
  await expect(map).toHaveAttribute('data-osm-ready', 'true', { timeout: 20000 });
  await expect
    .poll(async () => Number(await map.getAttribute('data-osm-rendered-points')))
    .toBeGreaterThan(0);
  await expect(page.getByText(/ใช้ขอบเขตจังหวัดในเครื่อง/u)).toBeVisible();
});

test('a failed tile after style load does not erase the street map', async ({ page }) => {
  let failedTiles = 0;
  await page.route('https://tile.openstreetmap.org/**', (route) => {
    if (failedTiles === 0) {
      failedTiles += 1;
      return route.abort();
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: tilePng });
  });

  await page.goto('/explore?view=osm');
  const map = page.getByLabel('แผนที่ถนนประเทศไทย');
  await expect(map).toHaveAttribute('data-osm-ready', 'true', { timeout: 20000 });
  await expect.poll(() => failedTiles).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  await page.waitForTimeout(750);
  await expect(map).toHaveAttribute('data-osm-fallback', 'false');
  await expect(map).toHaveAttribute('data-osm-provider', 'osm');
});

for (const locale of ['th', 'en'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    test(`OSM ${locale} view is responsive and accessible at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.route('https://tile.openstreetmap.org/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/png', body: tilePng }),
      );
      const mapLabel = locale === 'th' ? 'แผนที่ถนนประเทศไทย' : 'Street map of Thailand';
      await page.goto(`${locale === 'en' ? '/en' : ''}/explore?view=osm`);
      await expect(page.getByLabel(mapLabel)).toHaveAttribute('data-osm-ready', 'true', {
        timeout: 20000,
      });
      await expect
        .poll(async () =>
          Number(await page.getByLabel(mapLabel).getAttribute('data-osm-rendered-points')),
        )
        .toBeGreaterThan(0);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      await testInfo.attach(`osm-${locale}-${viewport.width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(
        axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
      ).toEqual([]);
    });
  }
}
