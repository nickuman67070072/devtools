import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ user: { id: '' } }));
vi.mock('@/lib/auth-guards', () => ({ requireAdmin: async () => session }));
import { prisma } from '@/lib/prisma';
import { findPublicPlaces, publicPlaceStats } from '@/lib/place-repository';
import { findConstructionHouses } from '@/lib/construction-repository';
import { moderateSubmission } from '@/features/admin/actions';

const prefix = `map-test-${randomUUID()}`;
let owner = '',
  other = '',
  provinceId = '',
  categoryId = '',
  approvedId = '';
beforeAll(async () => {
  const [admin, province, category] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } }),
    prisma.province.findUniqueOrThrow({ where: { code: '10' } }),
    prisma.category.findUniqueOrThrow({ where: { code: 'CAFE' } }),
  ]);
  session.user.id = admin.id;
  provinceId = province.id;
  categoryId = category.id;
  owner = (
    await prisma.user.create({
      data: { id: `${prefix}-owner`, name: prefix, email: `${prefix}-owner@pawmap.local` },
    })
  ).id;
  other = (
    await prisma.user.create({
      data: { id: `${prefix}-other`, name: prefix, email: `${prefix}-other@pawmap.local` },
    })
  ).id;
});
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: [owner, other] } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { startsWith: prefix } } });
  await prisma.submission.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.petRule.deleteMany({ where: { placeId: approvedId || prefix } });
  await prisma.place.deleteMany({
    where: { OR: [{ id: { startsWith: prefix } }, { id: approvedId || prefix }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
  await prisma.$disconnect();
});
it('keeps draft/pending houses private, then exposes the actual approved place and raises its province count', async () => {
  const proposed = {
    nameTh: prefix,
    descriptionTh: 'สถานที่สำหรับทดสอบการอนุมัติและแสดงบนแผนที่',
    addressTh: 'กรุงเทพมหานคร',
    latitude: 13.75,
    longitude: 100.5,
    petTypes: ['DOG'],
    indoorAllowed: true,
    outdoorAllowed: true,
    leashRequired: true,
    open24Hours: false,
  };
  for (const status of ['DRAFT', 'PENDING'] as const)
    await prisma.submission.create({
      data: {
        id: `${prefix}-${status}`,
        submitterId: owner,
        provinceId,
        categoryId,
        status,
        proposedData: proposed,
      },
    });
  const filters = { query: prefix };
  expect(await findConstructionHouses(owner, filters)).toHaveLength(2);
  expect(await findConstructionHouses(other, filters)).toHaveLength(0);
  expect(await findConstructionHouses(session.user.id, filters)).toHaveLength(2);
  expect((await publicPlaceStats(filters)).total).toBe(0);
  await prisma.user.update({ where: { id: owner }, data: { suspendedAt: new Date() } });
  expect(await findConstructionHouses(owner, filters)).toHaveLength(0);
  await prisma.user.update({ where: { id: owner }, data: { suspendedAt: null } });
  await prisma.user.update({ where: { id: owner }, data: { deletedAt: new Date() } });
  expect(await findConstructionHouses(owner, filters)).toHaveLength(0);
  await prisma.user.update({ where: { id: owner }, data: { deletedAt: null } });
  const result = await moderateSubmission({
    id: `${prefix}-PENDING`,
    decision: 'APPROVE',
    reason: 'ทดสอบแผนที่',
    revision: 1,
  });
  expect(result.ok).toBe(true);
  if (!result.ok || !result.data.placeId) throw new Error('Approval failed');
  approvedId = result.data.placeId;
  expect((await findPublicPlaces(filters)).map((place) => place.id)).toContain(approvedId);
  expect((await publicPlaceStats(filters)).provinces['10']).toBe(1);
  expect(await findConstructionHouses(owner, filters)).toHaveLength(1);
});
it('counts more than 750 matching places without applying the point limit to province heights', async () => {
  await prisma.place.createMany({
    data: Array.from({ length: 751 }, (_, index) => ({
      id: `${prefix}-${index}`,
      slug: `${prefix}-${index}`,
      nameTh: `${prefix}-bulk`,
      descriptionTh: 'test',
      addressTh: 'test',
      latitude: 13.75,
      longitude: 100.5,
      provinceId,
      categoryId,
      status: 'VERIFIED' as const,
      isVisible: true,
      source: 'ADMIN' as const,
    })),
  });
  const filter = { query: `${prefix}-bulk`, province: '10' };
  expect(await findPublicPlaces(filter)).toHaveLength(750);
  expect((await publicPlaceStats(filter)).provinces['10']).toBe(751);
  expect((await publicPlaceStats({ ...filter, categories: ['VET'] })).total).toBe(0);
});
