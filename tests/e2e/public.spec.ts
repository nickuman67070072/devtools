import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
test.describe('public experience', () => {
  test('home supports Thai and English navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ทุกที่ที่ไป');
    await page.getByRole('link', { name: 'EN' }).click();
    await expect(page).toHaveURL(/\/en$/u);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Everywhere you go');
  });
  test('home keeps the centered hero and exactly sixteen live categories', async ({ page }) => {
    await page.goto('/en');
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toBeVisible();
    expect(await heroHeading.evaluate((element) => getComputedStyle(element).textAlign)).toBe(
      'center',
    );
    await expect(page.getByText('Start your way')).toHaveCount(0);
    await expect(page.getByText('Places to explore')).toHaveCount(0);
    await expect(page.getByText('Know a great place?')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.locator('a[href^="/en/explore?categories="]')).toHaveCount(16);
  });
  test('retired data pages redirect home and public place responses omit sourceUrl', async ({
    page,
  }) => {
    await page.goto('/data-sources');
    await expect(page).toHaveURL(/\/$/u);
    await page.goto('/en/about');
    await expect(page).toHaveURL(/\/en$/u);
    const response = await page.request.get('/api/places/search?limit=1');
    expect(response.ok()).toBe(true);
    expect(JSON.stringify(await response.json())).not.toContain('sourceUrl');
  });
  test('mobile categories use an accessible eight-item pager', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('a[href^="/explore?categories="]:visible')).toHaveCount(8);
    await expect(page.locator('a[href="/explore?categories=VET"]')).toBeVisible();
    await page.getByRole('button', { name: 'หมวดหมู่ถัดไป' }).click();
    await expect(page.getByText('หน้า 2 จาก 2')).toBeVisible();
    await expect(page.locator('a[href="/explore?categories=VET"]')).toBeHidden();
    await expect(page.locator('a[href="/explore?categories=CAMPING"]')).toBeVisible();
  });
  test('desktop navigation is centered independently from account controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en');
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    const bounds = await navigation.boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs((bounds?.x ?? 0) + (bounds?.width ?? 0) / 2 - 720)).toBeLessThanOrEqual(2);
  });
  test('map loads controls and filters without emergency or location actions', async ({ page }) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto('/explore');
    await expect(page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ')).toBeVisible();
    await expect(page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ')).toHaveAttribute(
      'data-model-ready',
      'true',
      { timeout: 20000 },
    );
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
    await page.getByRole('button', { name: 'ซูมออก', exact: true }).click();
    await expect(page.getByRole('button', { name: 'กลับไปมุมมองประเทศไทย' })).toBeVisible();
    await page.getByRole('button', { name: /คาเฟ่/u }).click();
    await expect(page.getByRole('button', { name: /คาเฟ่/u })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('link', { name: /โหมดฉุกเฉิน/u })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ตำแหน่งฉัน' })).toHaveCount(0);
  });
  test('explore removes retired controls and sanitizes their old URL parameters', async ({
    page,
  }) => {
    await page.goto(
      '/en/explore?view=3d&categories=CAFE&openNow=true&twentyFourHours=true&verifiedOnly=true&minimumRating=4',
    );
    await expect.poll(() => new URL(page.url()).searchParams.has('openNow')).toBe(false);
    const params = new URL(page.url()).searchParams;
    expect(params.has('twentyFourHours')).toBe(false);
    expect(params.has('verifiedOnly')).toBe(false);
    expect(params.has('minimumRating')).toBe(false);
    expect(params.get('categories')).toBe('CAFE');
    await expect(page.getByText('Open now', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Open 24 hours', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Verified only', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Minimum rating', { exact: true })).toHaveCount(0);
  });
  test('place detail keeps all guest actions on one scrollable row and returns by slug', async ({
    page,
  }) => {
    const response = await page.request.get('/api/places/search?limit=50');
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as { items: { slug: string }[] };
    expect(JSON.stringify(payload)).not.toContain('sourceUrl');
    const place = payload.items.find((item) => /^[a-z0-9-]+$/u.test(item.slug));
    if (!place) throw new Error('Expected at least one public place with an ASCII slug');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/en/places/${place.slug}`);
    const actions = page.getByRole('group', { name: 'Place actions' });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('link')).toHaveCount(4);
    for (const label of ['Save', 'Confirm details', 'Write a review', 'Report incorrect data']) {
      const action = actions.getByRole('link', { name: label });
      await expect(action).toBeVisible();
      await expect(action).toHaveAttribute(
        'href',
        new RegExp(`next=%2Fen%2Fplaces%2F${place.slug}$`, 'u'),
      );
    }
    expect(await actions.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });
  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
  });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    test(`captures responsive visual evidence at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
      ).toBe(true);
      await testInfo.attach(`home-${viewport.width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
    });
  }
});
