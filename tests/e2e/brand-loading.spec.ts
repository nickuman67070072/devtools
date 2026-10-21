import { expect, test } from '@playwright/test';

test.describe('PawMap branded loading', () => {
  test('shows the minimal splash once per browser tab for at least 1.5 seconds', async ({
    page,
  }) => {
    await page.goto('/');
    const splash = page.getByTestId('brand-loading-fullscreen');
    const startedAt = Date.now();
    await expect(splash).toBeVisible();
    await expect(splash.locator('video')).toHaveCount(0);
    await expect(splash.locator('.brand-loading__mark')).toBeVisible();
    const background = await splash.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(background).toBe('rgba(0, 0, 0, 0)');
    await expect(splash).toBeHidden({ timeout: 6_000 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_350);
    await page.goto('/explore');
    await expect(splash).toHaveCount(0);
  });

  test('continues loading if the logo asset fails', async ({ page }) => {
    await page.route('**/brand/pawmap-mark.svg', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByTestId('brand-loading-fullscreen')).toBeVisible();
    await expect(page.getByTestId('brand-loading-fullscreen')).toBeHidden({ timeout: 6_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('stops progress animation when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const splash = page.getByTestId('brand-loading-fullscreen');
    await expect(splash).toBeVisible();
    await expect(splash.locator('.brand-loading__mark')).toBeVisible();
    const animation = await splash
      .locator('.brand-loading__progress')
      .evaluate((element) => getComputedStyle(element, '::after').animationName);
    expect(animation).toBe('none');
  });
});
