import { createHmac, randomBytes } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';
import type { BrowserContext } from '@playwright/test';

export async function seedBrowserSession(
  prisma: PrismaClient,
  context: BrowserContext,
  userId: string,
) {
  nextEnv.loadEnvConfig(process.cwd());
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for E2E sessions');
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + 60 * 60_000) },
  });
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  const value = encodeURIComponent(`${token}.${signature}`);
  const url = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
  const hostname = new URL(url).hostname;
  await context.addCookies([
    { name: 'pawmap.session_token', value, url, httpOnly: true, sameSite: 'Lax' },
    {
      name: '__Secure-pawmap.session_token',
      value,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}
