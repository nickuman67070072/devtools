import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { prisma } from '@/lib/prisma';
import { reviewImportedPlace } from '@/features/admin/import-service';
import {
  findPublicPlaces,
  findPublicMapPoints,
  getPublicPlace,
  publicPlaceStats,
} from '@/lib/place-repository';
import { normalizeImportRow } from '@/lib/place-import';

const prefix = `import-test-${randomUUID()}`;
let adminId = '',
  userId = '',
  batchId = '',
  provinceId = '',
  categoryId = '';
const createdPlaceIds: string[] = [];
const payload = normalizeImportRow(
  {
    id: prefix,
    name: prefix,
    categories: ['CAFE_RESTAURANT', 'DOG_RUN'],
    latitude: 13.75,
    longitude: 100.5,
    province: 'Bangkok',
    address: 'Address verified for this integration test',
    pet_policy: {
      source_policy_statement: 'Confirmed by the administrator for this integration test.',
    },
    sources: [{ url: 'https://source.invalid/place' }],
  },
  [
    {
      properties: { code: '10', nameTh: 'Bangkok', nameEn: 'Bangkok' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [100, 13],
            [101, 13],
            [101, 14],
            [100, 14],
            [100, 13],
          ],
        ],
      },
    },
  ],
)!;
beforeAll(async () => {
  adminId = (
    await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN', deletedAt: null, suspendedAt: null },
    })
  ).id;
  userId = (
    await prisma.user.create({
      data: { id: prefix, name: prefix, email: prefix + '@pawmap.local' },
    })
  ).id;
  provinceId = (await prisma.province.findUniqueOrThrow({ where: { code: '10' } })).id;
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { code: 'CAFE' } })).id;
  batchId = (
    await prisma.placeImportBatch.create({
      data: { dataset: prefix, sha256: prefix, fileName: 'fixture.json', total: 3, excluded: 1 },
    })
  ).id;
});
afterAll(async () => {
  await prisma.importedPlace.deleteMany({ where: { batchId } });
  await prisma.placeImportBatch.deleteMany({ where: { id: batchId } });
  await prisma.auditLog.deleteMany({ where: { entityId: { startsWith: prefix } } });
  await prisma.place.deleteMany({
    where: { OR: [{ id: { in: createdPlaceIds } }, { id: { startsWith: prefix } }] },
  });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});
async function record(suffix: string) {
  return prisma.importedPlace.create({
    data: {
      id: prefix + suffix,
      dataset: prefix,
      externalId: prefix + suffix,
      batchId,
      name: payload.name,
      categoryCodes: payload.categoryCodes,
      warnings: [],
      payload,
      provinceCode: '10',
    },
  });
}
it('keeps pending imports private; requires a live Admin; publishes once in both categories', async () => {
  const row = await record('-approve');
  expect((await publicPlaceStats({ query: prefix })).total).toBe(0);
  await expect(
    reviewImportedPlace(userId, { id: row.id, version: 1, decision: 'APPROVE' }),
  ).rejects.toThrow('ไม่มีสิทธิ์');
  const outcomes = await Promise.allSettled(
    [1, 2].map(() => reviewImportedPlace(adminId, { id: row.id, version: 1, decision: 'APPROVE' })),
  );
  expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  const published = await prisma.importedPlace.findUniqueOrThrow({ where: { id: row.id } });
  createdPlaceIds.push(published.placeId!);
  const publishedPlace = await prisma.place.findUniqueOrThrow({
    where: { id: published.placeId! },
    include: { verifications: true },
  });
  expect(JSON.stringify(publishedPlace.categoryDetails)).not.toContain('sources');
  expect(publishedPlace.verifications.every((item) => item.evidenceUrl === null)).toBe(true);
  const both = await findPublicPlaces({ query: prefix, categories: ['CAFE', 'DOG_RUN'] });
  expect(both).toHaveLength(1);
  expect(both[0]!.categoryCodes).toEqual(expect.arrayContaining(['CAFE', 'DOG_RUN']));
  const stats = await publicPlaceStats({ query: prefix });
  expect(stats.total).toBe(1);
  expect(stats.facets.CAFE).toBe(1);
  expect(stats.facets.DOG_RUN).toBe(1);
  expect(await findPublicPlaces({ query: prefix, categories: ['DOG_RUN'] })).toHaveLength(1);
});
it('requires missing fields to be corrected, blocks duplicates and links without overwriting', async () => {
  const row = await record('-duplicate');
  await expect(
    reviewImportedPlace(adminId, {
      id: row.id,
      version: 1,
      decision: 'APPROVE',
      payload: { ...payload, address: '' },
    }),
  ).rejects.toThrow('ให้ครบ');
  await expect(
    reviewImportedPlace(adminId, { id: row.id, version: 1, decision: 'APPROVE' }),
  ).rejects.toThrow('อาจซ้ำ');
  const result = await reviewImportedPlace(adminId, {
    id: row.id,
    version: 1,
    decision: 'APPROVE',
    linkPlaceId: createdPlaceIds[0],
  });
  expect(result.placeId).toBe(createdPlaceIds[0]);
  expect((await publicPlaceStats({ query: prefix })).total).toBe(1);
});
it('rejects with a reason and cannot approve a rejected revision', async () => {
  const row = await record('-reject');
  await expect(
    reviewImportedPlace(adminId, { id: row.id, version: 1, decision: 'REJECT' }),
  ).rejects.toThrow('เหตุผล');
  await reviewImportedPlace(adminId, {
    id: row.id,
    version: 1,
    decision: 'REJECT',
    reason: 'Insufficient evidence',
  });
  await expect(
    reviewImportedPlace(adminId, { id: row.id, version: 1, decision: 'APPROVE' }),
  ).rejects.toThrow('เปลี่ยนแล้ว');
});
it('publishes incomplete source-reported data only with an explicit reason, without a fake verification', async () => {
  const row = await record('-source-reported');
  const incomplete = {
    ...payload,
    name: prefix + '-source-reported',
    address: '',
    description: '',
  };
  await expect(
    reviewImportedPlace(adminId, {
      id: row.id,
      version: 1,
      decision: 'APPROVE',
      payload: incomplete,
      publishAsReported: true,
    }),
  ).rejects.toThrow('เหตุผล');
  const result = await reviewImportedPlace(adminId, {
    id: row.id,
    version: 1,
    decision: 'APPROVE',
    payload: incomplete,
    publishAsReported: true,
    reason: 'Explicit owner instruction to publish source-reported data with limitations',
  });
  createdPlaceIds.push(result.placeId!);
  const place = await prisma.place.findUniqueOrThrow({
    where: { id: result.placeId! },
    include: { verifications: true },
  });
  expect(place.status).toBe('STALE');
  expect(place.addressTh).toBe('');
  expect(place.lastVerifiedAt).toBeNull();
  expect(place.verifications).toHaveLength(0);
  const publicPlaces = await findPublicPlaces({ query: incomplete.name });
  expect(publicPlaces).toHaveLength(1);
  expect(publicPlaces[0]!.lastVerifiedAt).toBeNull();
});
it('serves places beyond the 750 marker page without double-counting category memberships', async () => {
  await prisma.place.createMany({
    data: Array.from({ length: 751 }, (_, index) => ({
      id: `${prefix}-page-${index}`,
      slug: `${prefix}-page-${index}`,
      nameTh: `${prefix}-page`,
      descriptionTh: 'pagination integration fixture',
      addressTh: 'Bangkok',
      latitude: 13.75,
      longitude: 100.5,
      provinceId,
      categoryId,
      source: 'ADMIN' as const,
      status: 'VERIFIED' as const,
    })),
  });
  const filters = { query: prefix + '-page' };
  expect(await findPublicPlaces(filters)).toHaveLength(750);
  expect(await findPublicPlaces(filters, { skip: 750, take: 750 })).toHaveLength(1);
  expect((await publicPlaceStats(filters)).total).toBe(751);
  const first = await findPublicMapPoints(filters);
  expect(first.items).toHaveLength(750);
  expect(first.nextCursor).toBe(750);
  expect(first.items[0]).not.toHaveProperty('descriptionTh');
  const second = await findPublicMapPoints(filters, first.nextCursor!);
  expect(second.items).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(751);
  const id = first.items[0]!.id;
  expect(await getPublicPlace(id)).not.toBeNull();
  await prisma.place.update({ where: { id }, data: { isVisible: false } });
  expect(await getPublicPlace(id)).toBeNull();
  expect((await findPublicMapPoints(filters)).items.some((item) => item.id === id)).toBe(false);
  await prisma.place.update({ where: { id }, data: { isVisible: true, status: 'PENDING' } });
  expect(await getPublicPlace(id)).toBeNull();
  expect((await findPublicMapPoints(filters)).items.some((item) => item.id === id)).toBe(false);
});
