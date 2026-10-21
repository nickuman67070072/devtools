import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

import { seedBrowserSession } from './helpers/session';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

test('signed-in user can submit a place for review', async ({ page }) => {
  const name = `สถานที่ทดสอบ E2E ${Date.now()}`;

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.user.email },
    });
    await seedBrowserSession(prisma, page.context(), user.id);
  } finally {
    await prisma.$disconnect();
  }

  await page.goto('/submit');
  await page.getByLabel('ชื่อภาษาไทย *').fill(name);
  await page.getByLabel('หมวดหมู่ *').selectOption('CAFE');
  await page
    .getByLabel('คำอธิบาย *')
    .fill('สถานที่สำหรับทดสอบขั้นตอนส่งข้อมูลอัตโนมัติของ PawMap Thailand');
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await page.getByLabel('ที่อยู่ *').fill('แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร');
  await page.getByLabel('จังหวัด *').selectOption('10');
  await page.getByLabel('Latitude').fill('13.7563');
  await page.getByLabel('Longitude').fill('100.5018');
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await page.getByText('สุนัข', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'สุนัข' })).toBeChecked();
  await page.getByLabel('อนุญาตพื้นที่กลางแจ้ง').check();
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await expect(page.getByText('ก่อนส่งข้อมูล', { exact: true })).toBeVisible();
  const submitButton = page.getByRole('button', { name: /ส่งให้ตรวจสอบ|กำลังส่ง/ });
  await expect(submitButton).toBeEnabled();
  const clickAttempt = submitButton.click({ timeout: 5_000 }).catch((error: unknown) => {
    if (!/\/my-submissions/u.test(page.url())) throw error;
  });
  await expect(page).toHaveURL(/my-submissions/u);
  await clickAttempt;
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText('PENDING', { exact: true }).first()).toBeVisible();
});
