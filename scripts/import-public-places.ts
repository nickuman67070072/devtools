import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';

import { prisma } from '../src/lib/prisma';
import { publicPlaceSnapshotSchema } from '../src/lib/public-place-snapshot';

const directory = path.resolve('prisma/data');
const manifest = JSON.parse(
  await readFile(path.join(directory, 'public-places.manifest.json'), 'utf8'),
) as { file: string; sha256: string; placeCount: number; categoryCount: number };
const compressed = await readFile(path.join(directory, manifest.file));
const actualHash = createHash('sha256').update(compressed).digest('hex');
if (actualHash !== manifest.sha256) throw new Error('Public place snapshot checksum mismatch');
const snapshot = publicPlaceSnapshotSchema.parse(
  JSON.parse(gunzipSync(compressed).toString('utf8')),
);
if (snapshot.places.length !== manifest.placeCount || manifest.categoryCount !== 16)
  throw new Error('Public place snapshot manifest mismatch');

try {
  const [provinces, districts, categories] = await Promise.all([
    prisma.province.findMany({ select: { id: true, code: true } }),
    prisma.district.findMany({
      select: { id: true, code: true, province: { select: { code: true } } },
    }),
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
  ]);
  if (provinces.length !== 77 || districts.length !== 926 || categories.length !== 16)
    throw new Error('Reference data must be seeded before importing public places');
  const provinceByCode = new Map(provinces.map((item) => [item.code, item.id]));
  const districtByCode = new Map(
    districts.map((item) => [`${item.province.code}:${item.code}`, item.id]),
  );
  const categoryByCode = new Map(categories.map((item) => [item.code, item.id]));

  for (const item of snapshot.places) {
    const provinceId = provinceByCode.get(item.provinceCode);
    const districtId = item.districtCode
      ? districtByCode.get(`${item.provinceCode}:${item.districtCode}`)
      : undefined;
    const categoryId = categoryByCode.get(item.primaryCategoryCode);
    const additionalIds = item.additionalCategoryCodes.map((code) => categoryByCode.get(code));
    if (!provinceId || !categoryId || additionalIds.some((id) => !id))
      throw new Error(`Unknown reference code in ${item.slug}`);
    const externalId = `release:${createHash('sha256').update(item.slug).digest('hex').slice(0, 24)}`;
    await prisma.$transaction(async (tx) => {
      const place = await tx.place.upsert({
        where: { slug: item.slug },
        update: {
          nameTh: item.nameTh,
          nameEn: item.nameEn,
          descriptionTh: item.descriptionTh,
          descriptionEn: item.descriptionEn,
          addressTh: item.addressTh,
          addressEn: item.addressEn,
          postalCode: item.postalCode,
          latitude: item.latitude,
          longitude: item.longitude,
          phone: item.phone,
          emergencyPhone: item.emergencyPhone,
          website: item.website,
          socialLinks: item.socialLinks
            ? (item.socialLinks as Prisma.InputJsonObject)
            : Prisma.JsonNull,
          source: 'OPEN_DATA',
          externalId,
          status: item.status,
          confidenceLevel: item.confidenceLevel,
          trustScore: item.trustScore,
          trustFactors: { releaseSnapshot: true },
          lastVerifiedAt: item.lastVerifiedAt ? new Date(item.lastVerifiedAt) : null,
          isVisible: true,
          isEmergency24Hours: item.isEmergency24Hours,
          categoryDetails: Prisma.JsonNull,
          averageRating: 0,
          reviewCount: 0,
          provinceId,
          districtId: districtId ?? null,
          categoryId,
          deletedAt: null,
          additionalCategories: { set: additionalIds.map((id) => ({ id: id! })) },
        },
        create: {
          slug: item.slug,
          nameTh: item.nameTh,
          nameEn: item.nameEn,
          descriptionTh: item.descriptionTh,
          descriptionEn: item.descriptionEn,
          addressTh: item.addressTh,
          addressEn: item.addressEn,
          postalCode: item.postalCode,
          latitude: item.latitude,
          longitude: item.longitude,
          phone: item.phone,
          emergencyPhone: item.emergencyPhone,
          website: item.website,
          socialLinks: item.socialLinks
            ? (item.socialLinks as Prisma.InputJsonObject)
            : Prisma.JsonNull,
          source: 'OPEN_DATA',
          externalId,
          status: item.status,
          confidenceLevel: item.confidenceLevel,
          trustScore: item.trustScore,
          trustFactors: { releaseSnapshot: true },
          lastVerifiedAt: item.lastVerifiedAt ? new Date(item.lastVerifiedAt) : null,
          isVisible: true,
          isEmergency24Hours: item.isEmergency24Hours,
          provinceId,
          districtId: districtId ?? null,
          categoryId,
          additionalCategories: { connect: additionalIds.map((id) => ({ id: id! })) },
        },
      });
      if (item.petRule) {
        await tx.petRule.upsert({
          where: { placeId: place.id },
          update: item.petRule,
          create: { ...item.petRule, placeId: place.id },
        });
      } else {
        await tx.petRule.deleteMany({ where: { placeId: place.id } });
      }
      await tx.businessHour.deleteMany({ where: { placeId: place.id } });
      if (item.businessHours.length) {
        await tx.businessHour.createMany({
          data: item.businessHours.map((hours) => ({ ...hours, placeId: place.id })),
        });
      }
    });
  }
  const total = await prisma.place.count({ where: { deletedAt: null, isVisible: true } });
  if (total !== manifest.placeCount)
    throw new Error(`Expected ${manifest.placeCount} public places after import, found ${total}`);
  console.log(`Imported ${total} public places.`);
} finally {
  await prisma.$disconnect();
}
