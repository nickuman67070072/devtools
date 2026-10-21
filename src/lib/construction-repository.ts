import 'server-only';
import { prisma } from '@/lib/prisma';
import type { MapFilters } from '@/lib/domain';
import type { ConstructionHouse } from '@/features/map/map-types';

export async function findConstructionHouses(
  userId: string,
  filters: MapFilters,
): Promise<ConstructionHouse[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, suspendedAt: null, deletedAt: null },
  });
  if (!user) return [];
  if (filters.verifiedOnly || filters.openNow || filters.twentyFourHours || filters.minimumRating)
    return [];
  const submissions = await prisma.submission.findMany({
    where: {
      deletedAt: null,
      status: { in: ['DRAFT', 'PENDING'] },
      ...(user.role === 'ADMIN' ? {} : { submitterId: user.id }),
      ...(filters.province
        ? { province: { OR: [{ code: filters.province }, { slug: filters.province }] } }
        : {}),
      ...(filters.district
        ? { district: { OR: [{ code: filters.district }, { nameEn: filters.district }] } }
        : {}),
      ...(filters.categories?.length ? { category: { code: { in: filters.categories } } } : {}),
    },
    include: { province: { select: { code: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 750,
  });
  return submissions.flatMap((submission) => {
    const data = submission.proposedData;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    if (
      data.latitude === null ||
      data.longitude === null ||
      data.latitude === '' ||
      data.longitude === ''
    )
      return [];
    const latitude = Number(data.latitude),
      longitude = Number(data.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 5 ||
      latitude > 21 ||
      longitude < 97 ||
      longitude > 106
    )
      return [];
    if (
      filters.bbox &&
      (longitude < filters.bbox[0] ||
        latitude < filters.bbox[1] ||
        longitude > filters.bbox[2] ||
        latitude > filters.bbox[3])
    )
      return [];
    const nameTh = typeof data.nameTh === 'string' ? data.nameTh : 'ฉบับร่าง';
    const nameEn = typeof data.nameEn === 'string' ? data.nameEn : nameTh;
    if (filters.query && !`${nameTh} ${nameEn}`.toLowerCase().includes(filters.query.toLowerCase()))
      return [];
    return [
      {
        id: submission.id,
        href:
          user.role === 'ADMIN'
            ? `/admin/submissions/${submission.id}`
            : `/my-submissions/${submission.id}`,
        nameTh,
        nameEn,
        provinceCode: submission.province.code,
        latitude,
        longitude,
        status: submission.status as 'DRAFT' | 'PENDING',
      },
    ];
  });
}
