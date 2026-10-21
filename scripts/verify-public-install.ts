import { prisma } from '../src/lib/prisma';

const expectAdmin = process.env.EXPECT_ADMIN === 'true';

try {
  const [provinces, districts, categories, places, users, admins, accounts, reviews, meetups] =
    await Promise.all([
      prisma.province.count(),
      prisma.district.count(),
      prisma.category.count(),
      prisma.place.count({ where: { deletedAt: null } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.account.count(),
      prisma.review.count(),
      prisma.meetup.count(),
    ]);

  const expected = expectAdmin
    ? {
        provinces: 77,
        districts: 926,
        categories: 16,
        places: 3091,
        users: 1,
        admins: 1,
        accounts: 1,
      }
    : {
        provinces: 77,
        districts: 926,
        categories: 16,
        places: 3091,
        users: 0,
        admins: 0,
        accounts: 0,
      };
  const actual = { provinces, districts, categories, places, users, admins, accounts };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => actual[key as keyof typeof actual] !== value)
    .map(
      ([key, value]) => `${key}: expected ${value}, received ${actual[key as keyof typeof actual]}`,
    );
  if (reviews !== 0 || meetups !== 0) {
    mismatches.push(`user content: expected 0 reviews/meetups, received ${reviews}/${meetups}`);
  }
  if (mismatches.length)
    throw new Error(`Public install verification failed: ${mismatches.join('; ')}`);

  console.log(
    `Public install verified: ${provinces} provinces, ${districts} districts, ${categories} categories, ${places} places, ${admins} administrators`,
  );
} finally {
  await prisma.$disconnect();
}
