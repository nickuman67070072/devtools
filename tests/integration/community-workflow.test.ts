import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';
import { testCredentials } from '../test-credentials';
const credentials = testCredentials();
const suffix = randomUUID().slice(0, 8);
let userId = '';
let placeId = '';
const collectionId = `test-collection-${suffix}`;
const reviewId = `test-review-${suffix}`;
const reportId = `test-report-${suffix}`;
const verificationId = `test-verification-${suffix}`;
describe('community ownership contract', () => {
  beforeAll(async () => {
    const [user, place] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: credentials.user.email } }),
      createPublicPlaceFixture(prisma, `community-${suffix}`),
    ]);
    userId = user.id;
    placeId = place.id;
  });
  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { collectionId } });
    await prisma.favoriteCollection.deleteMany({ where: { id: collectionId } });
    await prisma.review.deleteMany({ where: { id: reviewId } });
    await prisma.report.deleteMany({ where: { id: reportId } });
    await prisma.verification.deleteMany({ where: { id: verificationId } });
    await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.$disconnect();
  });
  it('links every user contribution to its owner', async () => {
    await prisma.favoriteCollection.create({
      data: { id: collectionId, name: `ทริป ${suffix}`, userId },
    });
    const [favorite, review, report, verification] = await prisma.$transaction([
      prisma.favorite.create({ data: { userId, placeId, collectionId } }),
      prisma.review.create({
        data: {
          id: reviewId,
          userId,
          placeId,
          rating: 5,
          cleanlinessRating: 5,
          convenienceRating: 5,
          petFriendlinessRating: 5,
          content: 'รีวิว integration ที่มีความยาวเพียงพอ',
        },
      }),
      prisma.report.create({
        data: {
          id: reportId,
          reporterId: userId,
          placeId,
          reason: 'INCORRECT_INFORMATION',
          details: 'รายละเอียดรายงาน integration ที่เพียงพอ',
        },
      }),
      prisma.verification.create({
        data: { id: verificationId, userId, placeId, note: 'ยืนยันจาก integration test' },
      }),
    ]);
    expect([favorite.userId, review.userId, report.reporterId, verification.userId]).toEqual([
      userId,
      userId,
      userId,
      userId,
    ]);
  });
});
