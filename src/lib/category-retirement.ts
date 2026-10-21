import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { retiredCategoryCodes } from './retired-categories';

export async function inspectRetirement(db: Prisma.TransactionClient) {
  const categories = await db.category.findMany({
    where: { code: { in: [...retiredCategoryCodes] } },
    orderBy: { id: 'asc' },
  });
  const categoryIds = categories.map((item) => item.id);
  const places = await db.place.findMany({
    where: {
      OR: [
        { categoryId: { in: categoryIds } },
        { additionalCategories: { some: { id: { in: categoryIds } } } },
      ],
    },
    include: {
      additionalCategories: { select: { id: true }, orderBy: { id: 'asc' } },
      petRule: true,
      businessHours: { orderBy: { id: 'asc' } },
      _count: {
        select: {
          images: true,
          reviews: true,
          favorites: true,
          reports: true,
          verifications: true,
          meetups: true,
          submissions: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  const placeIds = places.map((item) => item.id);
  const imports = await db.importedPlace.findMany({
    where: {
      OR: [
        { placeId: { in: placeIds } },
        { categoryCodes: { hasSome: [...retiredCategoryCodes, 'EMERGENCY_24H'] } },
      ],
    },
    orderBy: { id: 'asc' },
  });
  const categorySubmissions = await db.submission.count({
    where: { categoryId: { in: categoryIds } },
  });
  return {
    totalPlaces: await db.place.count(),
    totalCategories: await db.category.count(),
    categories,
    places,
    imports,
    categorySubmissions,
  };
}
export type RetirementManifest = Awaited<ReturnType<typeof inspectRetirement>>;
export function manifestHash(manifest: RetirementManifest): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}
export function assertRetirementSafe(manifest: RetirementManifest) {
  if (
    manifest.categories.length !== 13 ||
    manifest.places.length !== 110 ||
    manifest.imports.length !== 110 ||
    manifest.totalPlaces !== 3201 ||
    manifest.totalCategories !== 29
  )
    throw new Error('STOP: target counts changed; review and obtain new approval');
  const placeIds = new Set(manifest.places.map((item) => item.id));
  if (
    manifest.categorySubmissions ||
    manifest.places.some((item) => Object.values(item._count).some((count) => count > 0))
  )
    throw new Error('STOP: linked user data exists; no cascading deletion authorized');
  if (manifest.imports.some((item) => !item.placeId || !placeIds.has(item.placeId)))
    throw new Error('STOP: import records outside approved place targets');
}

export async function applyRetirement(
  db: PrismaClient,
  expected: RetirementManifest,
  actorId: string,
  backupSha256: string,
) {
  assertRetirementSafe(expected);
  return db.$transaction(
    async (tx) => {
      // Short maintenance transaction: prevent new relations/edits between the
      // final guard and deletion, including FK cascades which would lose user data.
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`LOCK TABLE categories, places, "_AdditionalPlaceCategories", imported_places,
      place_images, pet_rules, business_hours, reviews, favorites, reports,
      place_verifications, meetups, submissions IN SHARE ROW EXCLUSIVE MODE`;
      const actual = await inspectRetirement(tx);
      assertRetirementSafe(actual);
      if (manifestHash(actual) !== manifestHash(expected))
        throw new Error('STOP: manifest changed since backup/dry-run');
      const actor = await tx.user.findFirst({
        where: { id: actorId, role: 'ADMIN', deletedAt: null, suspendedAt: null },
      });
      if (!actor) throw new Error('An active administrator is required for audit attribution');
      const placeIds = actual.places.map((item) => item.id);
      const categoryIds = actual.categories.map((item) => item.id);
      await tx.importedPlace.deleteMany({
        where: { id: { in: actual.imports.map((item) => item.id) } },
      });
      // Only intrinsic place content and category joins cascade; all user relations
      // were checked above while write-locked. Import batch history is retained.
      await tx.place.deleteMany({ where: { id: { in: placeIds } } });
      await tx.category.deleteMany({ where: { id: { in: categoryIds } } });
      const remaining = { places: await tx.place.count(), categories: await tx.category.count() };
      if (remaining.places !== 3091 || remaining.categories !== 16)
        throw new Error('Unexpected post-delete counts');
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'RETIRE_CATEGORIES_PERMANENTLY',
          entityType: 'CategoryRetirement',
          entityId: manifestHash(expected),
          reason: 'User-approved removal of 13 exact categories and all 110 matching places',
          oldValue: {
            placeIds,
            categoryIds,
            importIds: actual.imports.map((item) => item.id),
            backupSha256,
          },
          newValue: remaining,
        },
      });
      return remaining;
    },
    { timeout: 60_000 },
  );
}
