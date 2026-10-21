import { expect, test } from '@playwright/test';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();
test('user can sign in, access profile, and sign out', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill(credentials.user.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(credentials.user.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/explore/u, { timeout: 15_000 });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'โปรไฟล์', exact: true })).toBeVisible();
  await page.getByLabel('ชื่อที่แสดง').fill('ผู้ใช้ทดสอบโปรไฟล์');
  await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
  await expect(page.getByText('บันทึกโปรไฟล์แล้ว')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ผู้ใช้ทดสอบโปรไฟล์' })).toBeVisible();
  await page.getByLabel('ชื่อที่แสดง').fill('ผู้ใช้ทดสอบ');
  await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
  await expect(page.getByRole('heading', { name: 'ผู้ใช้ทดสอบ' })).toBeVisible();
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await expect(page).toHaveURL(/\/$/u);
});
test('protected and admin routes enforce role on direct navigation', async ({ page }) => {
  await page.goto('/submit');
  await expect(page).toHaveURL(/login/u);
  await page.getByLabel('อีเมล').fill(credentials.user.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(credentials.user.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/explore/u, { timeout: 15_000 });
  await page.goto('/admin');
  await expect(page).toHaveURL(/unauthorized/u);
});
