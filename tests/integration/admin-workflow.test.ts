import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { testCredentials } from '../test-credentials';
const credentials = testCredentials();
const suffix = randomUUID().slice(0, 8);
const placeId = `test-admin-place-${suffix}`;
let actorId = '';
let provinceId = '';
let categoryId = '';
describe('admin audit contract', () => {
  beforeAll(async () => {
    const [actor, province, category] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: credentials.admin.email } }),
      prisma.province.findFirstOrThrow(),
      prisma.category.findFirstOrThrow(),
    ]);
    actorId = actor.id;
    provinceId = province.id;
    categoryId = category.id;
    await prisma.place.create({
      data: {
        id: placeId,
        slug: placeId,
        nameTh: 'สถานที่ทดสอบผู้ดูแล',
        descriptionTh: 'รายละเอียดทดสอบผู้ดูแลระบบ',
        addressTh: 'กรุงเทพมหานคร',
        latitude: 13.7,
        longitude: 100.5,
        source: 'ADMIN',
        status: 'VERIFIED',
        isVisible: true,
        provinceId,
        categoryId,
      },
    });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: placeId } });
    await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.$disconnect();
  });
  it('soft-deletes and restores with immutable audit records', async () => {
    await prisma.$transaction([
      prisma.place.update({
        where: { id: placeId },
        data: { deletedAt: new Date(), isVisible: false, version: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: { actorId, action: 'SOFT_DELETE', entityType: 'Place', entityId: placeId },
      }),
    ]);
    expect(await prisma.place.findFirst({ where: { id: placeId, deletedAt: null } })).toBeNull();
    expect(
      await prisma.auditLog.count({ where: { entityId: placeId, action: 'SOFT_DELETE' } }),
    ).toBe(1);
    await prisma.place.update({
      where: { id: placeId },
      data: { deletedAt: null, isVisible: true },
    });
    expect(
      await prisma.place.findFirst({ where: { id: placeId, isVisible: true } }),
    ).not.toBeNull();
  });
});
