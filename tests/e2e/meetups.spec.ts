import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { hashPassword } from 'better-auth/crypto';
import { expect, test } from '@playwright/test';

import { seedBrowserSession } from './helpers/session';
import { createPublicPlaceFixture } from '../helpers/place-fixture';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

async function createTestAccount(
  prisma: PrismaClient,
  name: string,
  email: string,
  password = `${randomUUID()}Aa1!`,
) {
  const user = await prisma.user.create({ data: { name, email, emailVerified: true } });
  await prisma.account.create({
    data: {
      issuer: 'local:credential',
      providerId: 'credential',
      accountId: user.id,
      userId: user.id,
      password: await hashPassword(password),
    },
  });
  return user;
}

test('Meetup discovery stays accessible and fits desktop, tablet, and mobile', async ({
  page,
}, testInfo) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/en/meetups');
    await expect(page.getByRole('heading', { name: 'Social Meetups' })).toBeVisible();
    await expect(page.getByText('Searching…')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Could not load meetups')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
    await testInfo.attach(`meetup-discovery-${width}`, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});

test('place autocomplete debounces, ignores stale results, supports keyboard selection and retry', async ({
  page,
}) => {
  let requestCount = 0;
  let failedOnce = false;
  await page.route('**/api/meetups/places?**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    requestCount += 1;
    if (q === 'fail' && !failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    if (q === 'ca') await new Promise((resolve) => setTimeout(resolve, 450));
    const name = q === 'ca' ? 'Slow Cafe' : q === 'fail' ? 'Recovered Place' : 'Fast Cafe';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: `place-${q}`,
            slug: `place-${q}`,
            nameTh: name,
            nameEn: name,
            addressTh: 'Bangkok',
            province: { nameTh: 'Bangkok', nameEn: 'Bangkok' },
            category: { nameTh: 'Cafe', nameEn: 'Cafe' },
          },
        ],
      }),
    });
  });
  await page.goto('/en/meetups');
  const input = page.locator('#meetup-place-search');

  await input.fill('c');
  await page.waitForTimeout(350);
  expect(requestCount).toBe(0);

  await input.fill('ca');
  await expect.poll(() => requestCount).toBe(1);
  await input.fill('cafe');
  await expect(page.getByRole('option').filter({ hasText: 'Fast Cafe' })).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.getByText('Selected place')).toBeVisible();
  await expect(page.getByText('Slow Cafe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear place' }).click();
  await expect(page.getByText('Selected place')).toHaveCount(0);

  await input.fill('fail');
  const autocompleteError = page.getByRole('alert').filter({ hasText: 'Search failed' });
  await expect(autocompleteError).toBeVisible();
  await autocompleteError.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('option').filter({ hasText: 'Recovered Place' })).toBeVisible();
});

test('Meetup discovery uses GPS only on click and supports a manual map point', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as Window & { geoCalls?: number }).geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success: unknown, error: (reason: { code: number }) => void) {
          (window as Window & { geoCalls?: number }).geoCalls =
            ((window as Window & { geoCalls?: number }).geoCalls ?? 0) + 1;
          error({ code: 1 });
        },
      },
    });
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pS0AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/meetups');
  await expect(page.getByRole('heading', { name: 'นัดเจอเพื่อนรักสัตว์' })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { geoCalls?: number }).geoCalls)).toBe(0);
  await page.getByRole('button', { name: 'ใช้ตำแหน่งปัจจุบัน' }).click();
  expect(await page.evaluate(() => (window as Window & { geoCalls?: number }).geoCalls)).toBe(1);
  await expect(page.getByRole('alert').filter({ hasText: 'ไม่ได้รับตำแหน่ง' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'แผนที่เลือกจุดค้นหา' })).toBeVisible();
  await page.locator('.maplibregl-canvas').click({ position: { x: 200, y: 150 } });
  await expect(page.getByText('จุดที่เลือก:')).toBeVisible();
});

test('guests sign in before requesting and return to the same Meetup', async ({ page }) => {
  const prisma = new PrismaClient();
  const nonce = Date.now();
  const email = `meetup-login-${nonce}@pawmap.local`;
  const password = `${randomUUID()}Aa1!`;
  let meetupId = '';
  let placeId = '';
  try {
    await createTestAccount(prisma, `Meetup Login ${nonce}`, email, password);
    const [host, place] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: credentials.user.email } }),
      createPublicPlaceFixture(prisma, `meetup-login-${nonce}`),
    ]);
    placeId = place.id;
    meetupId = (
      await prisma.meetup.create({
        data: {
          title: `Meetup login ${nonce}`,
          description: 'Checks login return destination before requesting access.',
          hostId: host.id,
          placeId: place.id,
          startsAt: new Date(Date.now() + 3 * 86_400_000),
          endsAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000),
          maxMembers: 4,
          members: { create: { userId: host.id } },
        },
      })
    ).id;
    await page.goto(`/en/meetups/${meetupId}`);
    await page.getByRole('link', { name: 'Sign in to request joining' }).click();
    await expect(page).toHaveURL(new RegExp(`/en/login\\?next=.*meetups`, 'u'));
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(new RegExp(`/en/meetups/${meetupId}$`, 'u'));
    await expect(page.getByRole('button', { name: 'Request to join Meetup' })).toBeVisible();
  } finally {
    if (meetupId) await prisma.meetup.deleteMany({ where: { id: meetupId } });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});

test('signed-in user can publish a Meetup at an approved place', async ({ page }) => {
  const prisma = new PrismaClient();
  let createdId: string | undefined;
  let createdTitle: string | undefined;
  let placeId = '';
  const hostEmail = `meetup-create-${Date.now()}@pawmap.local`;
  try {
    const user = await createTestAccount(prisma, 'Meetup Create Test', hostEmail);
    const meetupPlace = await createPublicPlaceFixture(prisma, `meetup-create-${Date.now()}`);
    placeId = meetupPlace.id;
    await seedBrowserSession(prisma, page.context(), user.id);
    await page.goto('/meetups/new');
    await page.locator('#meetup-place-query').fill(meetupPlace.nameTh);
    await expect(page.getByRole('option').filter({ hasText: meetupPlace.nameTh })).toBeVisible();
    await page.locator('#meetup-place-query').press('Enter');
    await expect(page.getByText(meetupPlace.nameTh, { exact: true })).toBeVisible();
    const title = `ทดสอบ Meetup ${Date.now()}`;
    createdTitle = title;
    await page.locator('input[name="title"]').fill(title);
    await page
      .locator('textarea[name="description"]')
      .fill('กิจกรรมทดสอบอัตโนมัติที่ผูกกับสถานที่ซึ่งอนุมัติแล้ว');
    const start = new Date(Date.now() + 2 * 86_400_000);
    const end = new Date(start.getTime() + 3_600_000);
    const bangkokInput = (date: Date) =>
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .format(date)
        .replace(' ', 'T');
    await page.locator('input[name="startsAt"]').fill(bangkokInput(start));
    await page.locator('input[name="endsAt"]').fill(bangkokInput(end));
    await page.getByRole('button', { name: 'เผยแพร่ Meetup' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/meetups\/(?!new$)[^/]+$/u, { timeout: 15_000 });
    createdId = new URL(page.url()).pathname.split('/').at(-1);
    const result = await page.request.post('/api/meetups/search', { data: {} });
    expect(result.ok()).toBe(true);
    expect(
      ((await result.json()) as { items: { id: string }[] }).items.some(
        (item) => item.id === createdId,
      ),
    ).toBe(true);
    await page.goto('/meetups');
    const activitySearch = page.getByRole('textbox', { name: 'ค้นหากิจกรรมหรือสถานที่' });
    await activitySearch.fill('no-matching-meetup-9981');
    await activitySearch.press('Enter');
    await expect(page.getByText('ยังไม่มี Meetup ที่ตรงกับเงื่อนไข')).toBeVisible();
    await activitySearch.fill('');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const selectedPlace = await prisma.meetup.findUniqueOrThrow({
      where: { id: createdId },
      include: { place: { select: { nameTh: true } } },
    });
    const placeSearch = page.locator('#meetup-place-search');
    await placeSearch.fill(selectedPlace.place.nameTh);
    await expect(
      page.getByRole('option').filter({ hasText: selectedPlace.place.nameTh }),
    ).toBeVisible();
    await placeSearch.press('Enter');
    await expect(page.getByText(selectedPlace.place.nameTh, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างสถานที่' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  } finally {
    if (createdTitle)
      await prisma.meetup.deleteMany({
        where: {
          title: createdTitle,
          host: { email: hostEmail },
        },
      });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.user.deleteMany({ where: { email: hostEmail } });
    await prisma.$disconnect();
  }
});

test('member joins, chats live, leaves, and loses access while public visitors cannot see members', async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  const prisma = new PrismaClient();
  const nonce = Date.now();
  const hostEmail = `meetup-host-${nonce}@pawmap.local`;
  const guestEmail = `meetup-guest-${nonce}@pawmap.local`;
  const guestName = `Meetup Guest ${nonce}`;
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  let meetupId: string | undefined;
  let placeId = '';
  try {
    const hostUser = await createTestAccount(prisma, `Meetup Host ${nonce}`, hostEmail);
    const guestUser = await createTestAccount(prisma, guestName, guestEmail);
    const meetupPlace = await createPublicPlaceFixture(prisma, `meetup-live-${nonce}`);
    placeId = meetupPlace.id;
    await seedBrowserSession(prisma, hostContext, hostUser.id);
    await seedBrowserSession(prisma, guestContext, guestUser.id);
    await host.goto('/en/meetups/new');
    await host.locator('#meetup-place-query').fill(meetupPlace.nameEn ?? meetupPlace.nameTh);
    await expect(
      host.getByRole('option').filter({ hasText: meetupPlace.nameEn ?? meetupPlace.nameTh }),
    ).toBeVisible();
    await host.locator('#meetup-place-query').press('Enter');
    const title = `Meetup live test ${nonce}`;
    await host.locator('input[name="title"]').fill(title);
    await host
      .locator('textarea[name="description"]')
      .fill('A safe meetup created for the browser integration test.');
    const start = new Date(Date.now() + 3 * 86_400_000);
    const dateInput = (date: Date) =>
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .format(date)
        .replace(' ', 'T');
    await host.locator('input[name="startsAt"]').fill(dateInput(start));
    await host
      .locator('input[name="endsAt"]')
      .fill(dateInput(new Date(start.getTime() + 3_600_000)));
    await host.getByRole('button', { name: 'Publish Meetup' }).click();
    await expect(host.getByRole('heading', { name: title })).toBeVisible({ timeout: 20_000 });
    meetupId = new URL(host.url()).pathname.split('/').at(-1);
    await guest.goto(`/en/meetups/${meetupId}`);
    await guest.getByRole('button', { name: 'Request to join Meetup' }).click();
    await expect(guest.getByText('Your request is awaiting host approval')).toBeVisible();
    expect(
      await guest.evaluate(
        async (id) => (await fetch(`/api/meetups/${id}/messages`)).status,
        meetupId,
      ),
    ).toBe(404);
    await page.goto(`/en/meetups/${meetupId}`);
    await expect(page.getByText(guestName)).toHaveCount(0);
    await host.goto(`/en/meetups/${meetupId}`);
    await host.getByRole('button', { name: 'Approve' }).click();
    await expect
      .poll(() =>
        prisma.meetupMember.count({
          where: { meetupId, userId: guestUser.id, state: 'ACTIVE' },
        }),
      )
      .toBe(1);
    await guest.goto(`/en/meetups/${meetupId}`);
    await expect(guest.getByRole('link', { name: 'Open group chat' })).toBeVisible();
    const unreadLoaded = host.waitForResponse((response) =>
      response.url().includes('/api/notifications/unread'),
    );
    await host.goto('/en/my-meetups');
    await unreadLoaded;
    await guest.goto(`/en/meetups/${meetupId}/chat`);
    const message = `Hello from guest ${nonce}`;
    await guest.getByRole('textbox', { name: 'Message' }).fill(message);
    await guest.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(
      host.getByRole('status').filter({ hasText: 'New Meetup chat message' }),
    ).toBeVisible({ timeout: 15_000 });
    await host
      .getByRole('status')
      .filter({ hasText: 'New Meetup chat message' })
      .getByRole('link')
      .click();
    await expect(host.getByText(message)).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByRole('article').filter({ hasText: message })).toHaveAttribute(
      'data-message-side',
      'right',
    );
    await expect(host.getByRole('article').filter({ hasText: message })).toHaveAttribute(
      'data-message-side',
      'left',
    );
    const uploaded = await guest.evaluate(async (id) => {
      const png = atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pS0AAAAASUVORK5CYII=',
      );
      const bytes = Uint8Array.from(png, (character) => character.charCodeAt(0));
      const form = new FormData();
      form.append('scope', 'chat');
      form.append('file', new File([bytes], 'meetup-test.png', { type: 'image/png' }));
      const response = await fetch(`/api/meetups/${id}/upload`, { method: 'POST', body: form });
      return { status: response.status, data: await response.json() };
    }, meetupId);
    expect(uploaded.status).toBe(201);
    const { mediaUrl } = uploaded.data as { mediaUrl: string };
    expect(await guest.evaluate(async (url) => (await fetch(url)).status, mediaUrl)).toBe(200);
    expect(await page.evaluate(async (url) => (await fetch(url)).status, mediaUrl)).toBe(404);
    await guest.goto(`/en/meetups/${meetupId}`);
    guest.once('dialog', (dialog) => void dialog.accept());
    await guest.getByRole('button', { name: 'Leave Meetup' }).click();
    await expect(guest.getByRole('button', { name: 'Request to join Meetup' })).toBeVisible();
    expect(
      await guest.evaluate(
        async (id) => (await fetch(`/api/meetups/${id}/messages`)).status,
        meetupId,
      ),
    ).toBe(404);
    expect(await guest.evaluate(async (url) => (await fetch(url)).status, mediaUrl)).toBe(404);
    const imageMessage = host.getByRole('article').filter({
      has: host.getByRole('img', { name: 'Meetup chat image' }),
    });
    await expect(imageMessage).toBeVisible();
    host.once('dialog', (dialog) => void dialog.accept());
    await imageMessage.getByRole('button', { name: 'Delete' }).click();
    await expect
      .poll(() => host.evaluate(async (url) => (await fetch(url)).status, mediaUrl))
      .toBe(404);
  } finally {
    const hostUser = await prisma.user.findUnique({
      where: { email: hostEmail },
      select: { id: true },
    });
    if (hostUser)
      await prisma.auditLog.deleteMany({ where: { entityType: 'Meetup', entityId: meetupId } });
    if (hostUser)
      await prisma.meetup.deleteMany({
        where: { hostId: hostUser.id, title: { startsWith: 'Meetup live test ' } },
      });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.user.deleteMany({ where: { email: { in: [hostEmail, guestEmail] } } });
    await prisma.$disconnect();
    await hostContext.close();
    await guestContext.close();
  }
});

test('chat bubbles and My Meetups lists stay usable with long conversations', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const prisma = new PrismaClient();
  const nonce = Date.now();
  const hostEmail = `meetup-scroll-host-${nonce}@pawmap.local`;
  const guestEmail = `meetup-scroll-guest-${nonce}@pawmap.local`;
  let meetupId = '';
  let placeId = '';
  try {
    const host = await createTestAccount(prisma, `Scroll Host ${nonce}`, hostEmail);
    const guest = await createTestAccount(prisma, `Scroll Guest ${nonce}`, guestEmail);
    const place = await createPublicPlaceFixture(prisma, `meetup-scroll-${nonce}`);
    placeId = place.id;
    meetupId = (
      await prisma.meetup.create({
        data: {
          title: `Scroll Meetup ${nonce}`,
          description: 'Long conversation and responsive list fixture.',
          hostId: host.id,
          placeId: place.id,
          startsAt: new Date(Date.now() + 3 * 86_400_000),
          endsAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000),
          maxMembers: 4,
          members: { create: [{ userId: host.id }, { userId: guest.id }] },
        },
      })
    ).id;
    await prisma.meetupMessage.createMany({
      data: Array.from({ length: 80 }, (_, index) => ({
        meetupId,
        authorId: index % 2 ? guest.id : host.id,
        kind: 'TEXT',
        text: `Scroll message ${index.toString().padStart(2, '0')}`,
        createdAt: new Date(Date.now() - (80 - index) * 1_000),
      })),
    });
    await seedBrowserSession(prisma, page.context(), host.id);
    await page.goto(`/en/meetups/${meetupId}/chat`);
    const log = page.getByRole('log', { name: 'Chat messages' });
    await expect(log).toBeVisible();
    await expect(log.getByRole('article').filter({ hasText: 'Scroll message 78' })).toHaveAttribute(
      'data-message-side',
      'right',
    );
    await expect(log.getByRole('article').filter({ hasText: 'Scroll message 79' })).toHaveAttribute(
      'data-message-side',
      'left',
    );
    expect(await log.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await log.getByRole('button', { name: 'Earlier messages' }).click();
    await expect(log.getByText('Scroll message 01')).toBeVisible();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        elements: [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 8)
          .map((element) => ({
            tag: element.tagName,
            className: String(element.className).slice(0, 120),
            right: Math.round(element.getBoundingClientRect().right),
          })),
      }));
      expect(overflow.scroll, JSON.stringify({ width, ...overflow })).toBeLessThanOrEqual(
        overflow.client,
      );
      await testInfo.attach(`meetup-chat-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
      await page.goto('/en/my-meetups');
      await expect(page.getByRole('heading', { name: 'My Meetups' })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
      await testInfo.attach(`my-meetups-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
      if (width !== 390) await page.goto(`/en/meetups/${meetupId}/chat`);
    }
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
  } finally {
    if (meetupId) await prisma.meetup.deleteMany({ where: { id: meetupId } });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.user.deleteMany({ where: { email: { in: [hostEmail, guestEmail] } } });
    await prisma.$disconnect();
  }
});

test('two concurrent joins cannot overbook the final seat', async ({ browser }) => {
  test.setTimeout(90_000);
  const prisma = new PrismaClient();
  const nonce = Date.now();
  const emails = [`meetup-race-a-${nonce}@pawmap.local`, `meetup-race-b-${nonce}@pawmap.local`];
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  let meetupId: string | undefined;
  let placeId = '';
  try {
    const [host, place] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: credentials.user.email } }),
      createPublicPlaceFixture(prisma, `meetup-race-${nonce}`),
    ]);
    placeId = place.id;
    const users: { id: string }[] = [];
    for (const [index, email] of emails.entries())
      users.push(await createTestAccount(prisma, `Meetup Race ${index} ${nonce}`, email));
    const meetup = await prisma.meetup.create({
      data: {
        title: `Meetup capacity race ${nonce}`,
        description: 'Checks the last seat when two people join at once.',
        hostId: host.id,
        placeId: place.id,
        startsAt: new Date(Date.now() + 3 * 86_400_000),
        endsAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000),
        maxMembers: 2,
        members: { create: { userId: host.id } },
      },
    });
    meetupId = meetup.id;
    await Promise.all(
      contexts.map((context, index) => seedBrowserSession(prisma, context, users[index]!.id)),
    );
    await Promise.all(pages.map((page) => page.goto(`/en/meetups/${meetupId}`)));
    await Promise.all(
      pages.map((page) => page.getByRole('button', { name: 'Request to join Meetup' }).click()),
    );
    await expect
      .poll(() => prisma.meetupJoinRequest.count({ where: { meetupId, status: 'PENDING' } }))
      .toBe(2);
    expect(await prisma.meetupMember.count({ where: { meetupId, state: 'ACTIVE' } })).toBe(1);
    const hostContext = await browser.newContext();
    try {
      await seedBrowserSession(prisma, hostContext, host.id);
      const hostPage = await hostContext.newPage();
      await hostPage.goto('/en/my-meetups?tab=requests');
      await expect(hostPage.getByRole('heading', { name: 'My Meetups' })).toBeVisible();
      await hostPage.getByRole('button', { name: 'Approve' }).first().click();
      await expect(hostPage.getByRole('button', { name: 'Approve' })).toHaveCount(1);
      await hostPage.getByRole('button', { name: 'Approve' }).click();
      await expect(hostPage.getByText('This Meetup is full.', { exact: true })).toBeVisible();
    } finally {
      await hostContext.close();
    }
    await expect
      .poll(() => prisma.meetupMember.count({ where: { meetupId, state: 'ACTIVE' } }))
      .toBe(2);
    const members = await prisma.meetupMember.findMany({
      where: { meetupId, state: 'ACTIVE', user: { email: { in: emails } } },
    });
    expect(members).toHaveLength(1);
    const statuses = await Promise.all(
      pages.map(async (page) => {
        let status = 0;
        await expect
          .poll(async () => {
            try {
              status = await page.evaluate(
                async (id) => (await fetch(`/api/meetups/${id}/messages`)).status,
                meetupId,
              );
            } catch (error) {
              if (
                !(error instanceof Error) ||
                !error.message.includes('Execution context was destroyed')
              )
                throw error;
            }
            return status;
          })
          .toBeGreaterThan(0);
        return status;
      }),
    );
    expect(statuses.sort()).toEqual([200, 404]);
  } finally {
    if (meetupId)
      await prisma.auditLog.deleteMany({ where: { entityType: 'Meetup', entityId: meetupId } });
    if (meetupId)
      await prisma.meetup.deleteMany({
        where: { id: meetupId, title: { startsWith: 'Meetup capacity race ' } },
      });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
    await Promise.all(contexts.map((context) => context.close()));
  }
});
