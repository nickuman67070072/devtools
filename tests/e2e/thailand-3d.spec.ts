import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const width of [1440, 768, 390]) {
  test(`3D Thailand renders actual model and houses at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/explore');
    const map = page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ');
    await expect(map).toHaveAttribute('data-model-ready', 'true', { timeout: 30000 });
    await expect(page.getByRole('status').filter({ hasText: 'บ้านในมุมมอง' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
    await page.getByRole('button', { name: 'กลับไปมุมมองประเทศไทย' }).click();
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No model canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 15, { steps: 5 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'กลับไปมุมมองประเทศไทย' }).click();
    await testInfo.attach(`thailand-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
  });
}
test('model failure shows retry and public places remain selectable', async ({ page, request }) => {
  expect((await request.get('/api/submissions/map')).status()).toBe(401);
  await page.route('**/models/thailand-77-provinces.glb', (route) => route.abort());
  await page.goto('/explore');
  await expect(page.getByText(/Cannot load 3D model/u)).toBeVisible();
  await page.locator('summary').filter({ hasText: 'เลือกสถานที่' }).click();
  const first = page.locator('details button').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole('button', { name: 'ปิดข้อมูลสถานที่' })).toBeVisible();
  await page.unroute('**/models/thailand-77-provinces.glb');
  await page.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ')).toHaveAttribute(
    'data-model-ready',
    'true',
    { timeout: 30000 },
  );
});
