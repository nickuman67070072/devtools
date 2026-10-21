import type { PrismaClient } from '@prisma/client';

export async function createPublicPlaceFixture(prisma: PrismaClient, prefix: string) {
  const [province, category] = await Promise.all([
    prisma.province.findUniqueOrThrow({ where: { code: '10' } }),
    prisma.category.findUniqueOrThrow({ where: { code: 'CAFE' } }),
  ]);

  return prisma.place.create({
    data: {
      id: `${prefix}-place`,
      slug: `${prefix}-place`,
      nameTh: `สถานที่ทดสอบ ${prefix}`,
      nameEn: `Test place ${prefix}`,
      descriptionTh: 'สถานที่ที่สร้างเฉพาะระหว่างการทดสอบอัตโนมัติ',
      descriptionEn: 'A fixture created only for an automated test.',
      addressTh: 'กรุงเทพมหานคร',
      addressEn: 'Bangkok',
      latitude: 13.7563,
      longitude: 100.5018,
      provinceId: province.id,
      categoryId: category.id,
      status: 'VERIFIED',
      confidenceLevel: 'HIGH',
      trustScore: 90,
      isVisible: true,
      source: 'ADMIN',
    },
  });
}
