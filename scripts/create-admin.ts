import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '../src/lib/prisma';
import { provisionCredentialUser } from '../prisma/provision-user';

const email = process.argv[2]?.trim().toLowerCase();
const passwordFileArgument = process.argv[3]?.trim();
if (!email || !passwordFileArgument) {
  throw new Error(
    'Usage: npm run admin:create -- <ADMIN_EMAIL> <PASSWORD_FILE_OUTSIDE_REPOSITORY>',
  );
}
const passwordFile = path.resolve(passwordFileArgument);
const projectRoot = path.resolve(process.cwd()) + path.sep;
if (passwordFile.toLowerCase().startsWith(projectRoot.toLowerCase())) {
  throw new Error('The password file must be stored outside the repository');
}
const password = (await readFile(passwordFile, 'utf8')).trim();
if (password.length < 12)
  throw new Error('The administrator password must be at least 12 characters');

try {
  const id = await provisionCredentialUser({
    email,
    password,
    name: process.env.ADMIN_DISPLAY_NAME?.trim() || 'PawMap Administrator',
    role: 'ADMIN',
  });
  console.log(`Administrator created or updated: ${id}`);
} finally {
  await prisma.$disconnect();
}
