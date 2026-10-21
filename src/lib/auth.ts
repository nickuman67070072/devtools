import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { getTrustedOrigins } from '@/lib/auth-origins';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { requiredEnvironment } from '@/lib/server-config';

const authBaseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

export const auth = betterAuth({
  appName: 'PawMap Thailand',
  baseURL: authBaseUrl,
  secret: requiredEnvironment('BETTER_AUTH_SECRET'),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  trustedOrigins: getTrustedOrigins(authBaseUrl, process.env.APP_ORIGIN),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ email: user.email, name: user.name, url });
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, input: false, defaultValue: 'USER' },
      locale: { type: 'string', required: false, defaultValue: 'th' },
      suspendedAt: { type: 'date', required: false, input: false },
    },
  },
  verification: { modelName: 'AuthVerification' },
  advanced: {
    cookiePrefix: 'pawmap',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  rateLimit: {
    enabled: true,
    window: 15 * 60,
    max: 100,
    customRules: {
      '/get-session': { window: 60, max: 300 },
      '/sign-in/email': { window: 15 * 60, max: 5 },
      '/sign-up/email': { window: 60 * 60, max: 10 },
      '/request-password-reset': { window: 60 * 60, max: 5 },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
