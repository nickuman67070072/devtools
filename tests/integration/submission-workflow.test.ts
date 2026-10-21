import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();
const suffix = randomUUID().slice(0, 8);
const submissionId = `test-submission-${suffix}`;
const placeId = `test-place-${suffix}`;
let userId = '';
let provinceId = '';
let categoryId = '';
describe('submission workflow database contract', () => {
  beforeAll(async () => {
    const [user, province, category] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: credentials.user.email } }),
      prisma.province.findFirstOrThrow(),
      prisma.category.findFirstOrThrow(),
    ]);
    userId = user.id;
    provinceId = province.id;
    categoryId = category.id;
  });
  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { id: submissionId } });
    await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.$disconnect();
  });
  it('keeps pending data private and approves place atomically', async () => {
    const proposed = {
      nameTh: `สถานที่ทดสอบ ${suffix}`,
      descriptionTh: 'ข้อมูลทดสอบ integration แบบข้อความธรรมดาที่มีความยาวเพียงพอ',
      addressTh: 'กรุงเทพมหานคร',
      latitude: 13.75,
      longitude: 100.5,
      petTypes: ['DOG'],
    };
    await prisma.submission.create({
      data: {
        id: submissionId,
        submitterId: userId,
        provinceId,
        categoryId,
        status: 'PENDING',
        submittedAt: new Date(),
        proposedData: proposed,
      },
    });
    expect(
      await prisma.place.findFirst({ where: { nameTh: proposed.nameTh, isVisible: true } }),
    ).toBeNull();
    await prisma.$transaction(async (tx) => {
      await tx.place.create({
        data: {
          id: placeId,
          slug: placeId,
          nameTh: proposed.nameTh,
          descriptionTh: proposed.descriptionTh,
          addressTh: proposed.addressTh,
          latitude: proposed.latitude,
          longitude: proposed.longitude,
          source: 'USER_SUBMISSION',
          status: 'VERIFIED',
          isVisible: true,
          provinceId,
          categoryId,
        },
      });
      await tx.submission.update({
        where: { id: submissionId },
        data: { status: 'APPROVED', targetPlaceId: placeId, reviewedRevision: 1 },
      });
    });
    expect(
      await prisma.place.findFirst({ where: { id: placeId, status: 'VERIFIED', isVisible: true } }),
    ).not.toBeNull();
  });
});
