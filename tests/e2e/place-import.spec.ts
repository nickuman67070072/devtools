import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

test('admin reviews an import, publishes one multi-category marker, and public visitors cannot read the queue', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const db = new PrismaClient();
  const id = 'import-browser-' + randomUUID();
  let placeId: string | null = null;
  try {
    const batch = await db.placeImportBatch.create({
      data: {
        id,
        dataset: id,
        sha256: id,
        fileName: 'browser-fixture.json',
        total: 1,
        excluded: 0,
      },
    });
    await db.importedPlace.create({
      data: {
        id,
        batchId: batch.id,
        dataset: id,
        externalId: id,
        name: id,
        provinceCode: '10',
        categoryCodes: ['CAFE', 'DOG_RUN'],
        warnings: [],
        payload: {
          id,
          name: id,
          nameEn: '',
          description: 'สถานที่ทดสอบการตรวจข้อมูลนำเข้า ไม่ใช่ข้อมูลจริง',
          address: 'กรุงเทพมหานคร สำหรับทดสอบเท่านั้น',
          provinceCode: '10',
          latitude: 13.75,
          longitude: 100.5,
          categoryCodes: ['CAFE', 'DOG_RUN'],
          phone: '',
          website: '',
          sources: [],
          policy: '',
          qualityFlags: [],
          acceptanceContext: '',
          is24Hours: null,
        },
      },
    });
    await page.goto('/admin/imports/' + id);
    await expect(page).toHaveURL(/login/u);
    expect((await (await request.get('/api/places/map?q=' + id)).json()).total).toBe(0);
    await page.getByLabel('อีเมล').fill(credentials.admin.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(credentials.admin.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
    await expect(page).not.toHaveURL(/login/u);
    await page.goto('/admin/imports/' + id);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        page.getByRole('button', { name: 'อนุมัติและเผยแพร่', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
        ['serious', 'critical'].includes(item.impact ?? ''),
      );
      expect(violations).toEqual([]);
      await page.screenshot({ path: `test-results/import-review-${width}.png`, fullPage: true });
    }
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'อนุมัติและเผยแพร่', exact: true }).click();
    await expect(page.getByText('บันทึกผลแล้ว', { exact: true })).toBeVisible();
    const row = await db.importedPlace.findUniqueOrThrow({ where: { id } });
    placeId = row.placeId;
    expect(row.status).toBe('APPROVED');
    const map = await (await request.get('/api/places/map?q=' + id + '&categories=DOG_RUN')).json();
    expect(map.total).toBe(1);
    expect(map.features[0].properties.categoryCodes).toEqual(
      expect.arrayContaining(['CAFE', 'DOG_RUN']),
    );
    for (const view of ['3d', 'osm']) {
      await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
      await page.goto(`/explore?view=${view}&q=${id}`);
      await page.locator('summary').filter({ hasText: 'เลือกสถานที่' }).click();
      await expect(
        page.locator('details').getByRole('button', { name: id, exact: true }),
      ).toBeVisible({
        timeout: 30000,
      });
      await page.screenshot({ path: `test-results/import-map-${view}.png`, fullPage: true });
    }
  } finally {
    placeId ??= (await db.importedPlace.findUnique({ where: { id } }))?.placeId ?? null;
    await db.importedPlace.deleteMany({ where: { id } });
    await db.placeImportBatch.deleteMany({ where: { id } });
    await db.auditLog.deleteMany({ where: { entityId: id } });
    if (placeId) await db.place.delete({ where: { id: placeId } });
    await db.$disconnect();
  }
});
