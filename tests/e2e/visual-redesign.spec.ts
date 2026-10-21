import { PrismaClient } from '@prisma/client';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { seedBrowserSession } from './helpers/session';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

test.setTimeout(240_000);

async function attachPage(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByTestId('brand-loading-fullscreen')).toHaveCount(0, { timeout: 6_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
    contentType: 'image/png',
  });
}

async function authenticateSeedUser(page: Page, email: string) {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await seedBrowserSession(prisma, page.context(), user.id);
  } finally {
    await prisma.$disconnect();
  }
}

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

test('captures every redesigned route family at desktop, tablet, and mobile sizes', async ({
  page,
}, testInfo) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const [name, path] of [
      ['home', '/'],
      ['home-en', '/en'],
      ['explore-3d', '/explore'],
      ['explore-3d-en', '/en/explore'],
      ['explore-osm', '/explore?view=osm'],
      ['meetups', '/meetups'],
      ['meetups-en', '/en/meetups'],
      ['emergency', '/emergency'],
      ['auth', '/login'],
    ] as const) {
      await page.goto(path);
      await attachPage(page, testInfo, `${name}-${viewport.width}`);
    }

    const placesResponse = await page.request.get('/api/places/map?bbox=97,5,106,21');
    const places = placesResponse.ok()
      ? ((await placesResponse.json()) as {
          features: Array<{ properties: { slug: string } }>;
        })
      : null;
    const placeSlug = places?.features.find((feature) =>
      /^[a-z0-9-]+$/u.test(feature.properties.slug),
    )?.properties.slug;
    if (placeSlug) {
      for (const [name, path] of [
        ['place-detail', `/places/${placeSlug}`],
        ['place-detail-en', `/en/places/${placeSlug}`],
      ] as const) {
        await page.goto(path);
        await expect(
          page.getByRole('group', { name: /การมีส่วนร่วมกับสถานที่|Place actions/u }),
        ).toBeVisible();
        await attachPage(page, testInfo, `${name}-${viewport.width}`);
      }
    }
  }

  await authenticateSeedUser(page, credentials.user.email);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const [name, path] of [
      ['user-list', '/my-submissions'],
      ['user-form', '/submit'],
      ['meetup-create', '/meetups/new'],
      ['meetup-create-en', '/en/meetups/new'],
    ] as const) {
      await page.goto(path);
      await attachPage(page, testInfo, `${name}-${viewport.width}`);
    }
  }

  await page.context().clearCookies();
  await authenticateSeedUser(page, credentials.admin.email);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const [name, path] of [
      ['admin-dashboard', '/admin'],
      ['admin-list', '/admin/submissions'],
      ['admin-form', '/admin/places/new'],
    ] as const) {
      await page.goto(path);
      await attachPage(page, testInfo, `${name}-${viewport.width}`);
    }

    const detailLink = page.locator('a[href^="/admin/submissions/"]').first();
    await page.goto('/admin/submissions');
    if ((await detailLink.count()) > 0) {
      await detailLink.click();
      await attachPage(page, testInfo, `admin-detail-${viewport.width}`);
    }
  }
});
