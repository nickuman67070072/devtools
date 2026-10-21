import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { categoryDefinitions } from '../src/lib/domain';
import { prisma } from '../src/lib/prisma';

interface BoundaryProperties {
  code: string;
  provinceCode: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  centroidLat: number;
  centroidLng: number;
}

interface BoundaryFile {
  features: Array<{ properties: BoundaryProperties }>;
}

async function readBoundary(name: 'provinces' | 'districts') {
  const file = await readFile(
    path.join(process.cwd(), 'public', 'data', 'boundaries', `${name}.geojson`),
    'utf8',
  );
  return JSON.parse(file) as BoundaryFile;
}

async function main() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  const [provincesFile, districtsFile] = await Promise.all([
    readBoundary('provinces'),
    readBoundary('districts'),
  ]);

  for (const feature of provincesFile.features) {
    const item = feature.properties;
    await prisma.province.upsert({
      where: { code: item.code },
      update: {
        slug: item.slug,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        centroidLat: item.centroidLat,
        centroidLng: item.centroidLng,
      },
      create: {
        code: item.code,
        slug: item.slug,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        centroidLat: item.centroidLat,
        centroidLng: item.centroidLng,
      },
    });
  }

  const provinces = await prisma.province.findMany();
  const provinceByCode = new Map(provinces.map((province) => [province.code, province]));
  for (const feature of districtsFile.features) {
    const item = feature.properties;
    const province = provinceByCode.get(item.provinceCode);
    if (!province)
      throw new Error(`District ${item.code} refers to unknown province ${item.provinceCode}`);
    await prisma.district.upsert({
      where: { provinceId_code: { provinceId: province.id, code: item.code } },
      update: {
        slug: `${item.slug}-${item.code}`,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        centroidLat: item.centroidLat,
        centroidLng: item.centroidLng,
      },
      create: {
        provinceId: province.id,
        code: item.code,
        slug: `${item.slug}-${item.code}`,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        centroidLat: item.centroidLat,
        centroidLng: item.centroidLng,
      },
    });
  }

  for (const [sortOrder, category] of categoryDefinitions.entries()) {
    await prisma.category.upsert({
      where: { code: category.code },
      update: { ...category, sortOrder, isActive: true },
      create: { ...category, sortOrder, isActive: true },
    });
  }

  console.log(
    `Seeded ${provincesFile.features.length} provinces, ${districtsFile.features.length} districts, and ${categoryDefinitions.length} categories.`,
  );
}

main().finally(async () => prisma.$disconnect());
