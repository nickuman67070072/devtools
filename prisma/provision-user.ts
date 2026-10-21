import { hashPassword } from 'better-auth/crypto';

import { auth } from '../src/lib/auth';
import { prisma } from '../src/lib/prisma';

export async function provisionCredentialUser(input: {
  email: string;
  password: string;
  name: string;
  role: 'USER' | 'ADMIN';
}) {
  let user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
  }
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { role: input.role, emailVerified: true, suspendedAt: null },
    }),
    prisma.account.upsert({
      where: {
        providerId_accountId: { providerId: 'credential', accountId: user.id },
      },
      update: { issuer: 'local:credential', userId: user.id, password: passwordHash },
      create: {
        issuer: 'local:credential',
        providerId: 'credential',
        accountId: user.id,
        userId: user.id,
        password: passwordHash,
      },
    }),
  ]);
  return user.id;
}
