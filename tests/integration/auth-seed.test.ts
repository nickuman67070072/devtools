import { verifyPassword } from 'better-auth/crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

describe('seeded credential accounts', () => {
  afterAll(async () => prisma.$disconnect());

  it.each([
    {
      email: credentials.admin.email,
      password: credentials.admin.password,
      role: 'ADMIN' as const,
    },
    {
      email: credentials.user.email,
      password: credentials.user.password,
      role: 'USER' as const,
    },
  ])('creates a working credential for $email', async ({ email, password, role }) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: {
        accounts: {
          where: { providerId: 'credential' },
        },
      },
    });

    expect(user.role).toBe(role);
    expect(user.emailVerified).toBe(true);
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]?.password).toBeTruthy();
    await expect(
      verifyPassword({ hash: user.accounts[0]?.password ?? '', password }),
    ).resolves.toBe(true);
  });
});
