import { prisma } from '../src/lib/prisma';
import { requiredEnvironment } from '../src/lib/server-config';
import { provisionCredentialUser } from './provision-user';

try {
  await provisionCredentialUser({
    email: requiredEnvironment('SEED_ADMIN_EMAIL'),
    password: requiredEnvironment('SEED_ADMIN_PASSWORD'),
    name: 'PawMap Test Admin',
    role: 'ADMIN',
  });
  await provisionCredentialUser({
    email: requiredEnvironment('SEED_USER_EMAIL'),
    password: requiredEnvironment('SEED_USER_PASSWORD'),
    name: 'PawMap Test User',
    role: 'USER',
  });
  console.log('Seeded credential accounts from the test environment.');
} finally {
  await prisma.$disconnect();
}
