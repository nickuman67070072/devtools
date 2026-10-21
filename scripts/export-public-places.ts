import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '../src/lib/prisma';
import { publicPlaceSnapshotSchema } from '../src/lib/public-place-snapshot';

const outputDirectory = path.resolve('prisma/data');
const snapshotPath = path.join(outputDirectory, 'public-places.v1.json.gz');
const manifestPath = path.join(outputDirectory, 'public-places.manifest.json');

try {
  const places = await prisma.place.findMany({
    where: { deletedAt: null, isVisible: true, status: { not: 'PENDING' } },
    include: {
      province: { select: { code: true } },
      district: { select: { code: true } },
      category: { select: { code: true } },
      additionalCategories: { select: { code: true }, orderBy: { code: 'asc' } },
      petRule: true,
      businessHours: { orderBy: [{ weekday: 'asc' }, { intervalOrder: 'asc' }] },
    },
    orderBy: { slug: 'asc' },
  });
  const snapshot = publicPlaceSnapshotSchema.parse({
    schemaVersion: 1,
    places: places.map((place) => ({
      slug: place.slug,
      nameTh: place.nameTh,
      nameEn: place.nameEn,
      descriptionTh: place.descriptionTh,
      descriptionEn: place.descriptionEn,
      addressTh: place.addressTh,
      addressEn: place.addressEn,
      postalCode: place.postalCode,
      latitude: place.latitude,
      longitude: place.longitude,
      phone: place.phone,
      emergencyPhone: place.emergencyPhone,
      website: place.website,
      socialLinks: place.socialLinks,
      status: place.status,
      confidenceLevel: place.confidenceLevel,
      trustScore: place.trustScore,
      lastVerifiedAt: place.lastVerifiedAt?.toISOString() ?? null,
      isEmergency24Hours: place.isEmergency24Hours,
      provinceCode: place.province.code,
      districtCode: place.district?.code ?? null,
      primaryCategoryCode: place.category.code,
      additionalCategoryCodes: place.additionalCategories.map((item) => item.code),
      petRule: place.petRule
        ? {
            petTypes: place.petRule.petTypes,
            petSizes: place.petRule.petSizes,
            indoorAllowed: place.petRule.indoorAllowed,
            outdoorAllowed: place.petRule.outdoorAllowed,
            leashRequired: place.petRule.leashRequired,
            carrierRequired: place.petRule.carrierRequired,
            strollerRequired: place.petRule.strollerRequired,
            diaperRequired: place.petRule.diaperRequired,
            freeEntry: place.petRule.freeEntry,
            feeDescriptionTh: place.petRule.feeDescriptionTh,
            feeDescriptionEn: place.petRule.feeDescriptionEn,
            maximumWeightKg: place.petRule.maximumWeightKg,
            maximumPetCount: place.petRule.maximumPetCount,
            advanceNotice: place.petRule.advanceNotice,
            hasParking: place.petRule.hasParking,
            hasDrinkingWater: place.petRule.hasDrinkingWater,
            hasWasteArea: place.petRule.hasWasteArea,
            hasRamp: place.petRule.hasRamp,
          }
        : null,
      businessHours: place.businessHours.map(
        ({ weekday, intervalOrder, opensAt, closesAt, isClosed, is24Hours }) => ({
          weekday,
          intervalOrder,
          opensAt,
          closesAt,
          isClosed,
          is24Hours,
        }),
      ),
    })),
  });
  if (snapshot.places.length !== 3091) {
    throw new Error(`Expected 3091 public places, found ${snapshot.places.length}`);
  }
  const plain = Buffer.from(JSON.stringify(snapshot));
  const compressed = gzipSync(plain, { level: 9 });
  const sha256 = createHash('sha256').update(compressed).digest('hex');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(snapshotPath, compressed);
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        file: path.basename(snapshotPath),
        sha256,
        placeCount: snapshot.places.length,
        categoryCount: 16,
        containsUserData: false,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Exported ${snapshot.places.length} public places (${sha256}).`);
} finally {
  await prisma.$disconnect();
}
