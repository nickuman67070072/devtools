import 'server-only';

import { Prisma, Weekday } from '@prisma/client';

import {
  categoryDefinitions,
  type MapFilters,
  type MapPoint,
  type PlaceSummary,
} from '@/lib/domain';
import { prisma } from '@/lib/prisma';

const dayNames = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
];

const include = {
  province: true,
  district: true,
  category: true,
  additionalCategories: true,
  petRule: true,
  businessHours: true,
} satisfies Prisma.PlaceInclude;
type PlaceRecord = Prisma.PlaceGetPayload<{ include: typeof include }>;

function toSummary(place: PlaceRecord): PlaceSummary {
  const category =
    categoryDefinitions.find((item) => item.code === place.category.code) ?? categoryDefinitions[0];
  const rules = [
    place.petRule?.leashRequired ? 'ต้องใส่สายจูง / Leash required' : null,
    place.petRule?.carrierRequired ? 'ต้องใช้กระเป๋า / Carrier required' : null,
    place.petRule?.indoorAllowed ? 'เข้าอาคารได้ / Indoor allowed' : null,
    place.petRule?.outdoorAllowed ? 'พื้นที่กลางแจ้ง / Outdoor allowed' : null,
  ].filter((item): item is string => Boolean(item));
  const amenities = [
    place.petRule?.hasParking ? 'ที่จอดรถ / Parking' : null,
    place.petRule?.hasDrinkingWater ? 'น้ำดื่ม / Drinking water' : null,
    place.petRule?.hasWasteArea ? 'จุดทิ้งของเสีย / Waste area' : null,
    place.petRule?.hasRamp ? 'ทางลาด / Ramp' : null,
  ].filter((item): item is string => Boolean(item));
  const today = dayNames[new Date().getDay()];
  const todayHours = place.businessHours.filter((hour) => hour.weekday === today);
  return {
    id: place.id,
    slug: place.slug,
    nameTh: place.nameTh,
    nameEn: place.nameEn || place.nameTh,
    descriptionTh: place.descriptionTh,
    descriptionEn: place.descriptionEn || place.descriptionTh,
    addressTh: place.addressTh,
    addressEn: place.addressEn || place.addressTh,
    provinceCode: place.province.code,
    provinceSlug: place.province.slug,
    provinceNameTh: place.province.nameTh,
    provinceNameEn: place.province.nameEn,
    districtNameTh: place.district?.nameTh ?? '',
    districtNameEn: place.district?.nameEn ?? '',
    categoryCode: category.code,
    categoryCodes: [
      ...new Set([category.code, ...place.additionalCategories.map((item) => item.code)]),
    ].filter((code): code is PlaceSummary['categoryCode'] =>
      categoryDefinitions.some((item) => item.code === code),
    ),
    categoryNameTh: place.category.nameTh,
    categoryNameEn: place.category.nameEn,
    categoryColor: place.category.color,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.averageRating,
    reviewCount: place.reviewCount,
    status: place.status === 'PENDING' ? 'STALE' : place.status,
    confidence: place.confidenceLevel,
    trustScore: place.trustScore,
    lastVerifiedAt: place.lastVerifiedAt?.toISOString() ?? null,
    isOpenNow:
      place.isEmergency24Hours || todayHours.some((hour) => hour.is24Hours || !hour.isClosed),
    is24Hours: place.isEmergency24Hours || place.businessHours.some((hour) => hour.is24Hours),
    phone: place.phone ?? '—',
    website: place.website ?? undefined,
    petTypes: place.petRule?.petTypes ?? [],
    rules,
    amenities,
  };
}

export function publicPlaceWhere(filters: MapFilters = {}): Prisma.PlaceWhereInput {
  const conditions: Prisma.PlaceWhereInput[] = [];
  if (filters.categories?.length)
    conditions.push({
      OR: [
        { category: { code: { in: filters.categories } } },
        { additionalCategories: { some: { code: { in: filters.categories } } } },
      ],
    });
  if (filters.query) {
    conditions.push({
      OR: [
        { nameTh: { contains: filters.query, mode: 'insensitive' } },
        { nameEn: { contains: filters.query, mode: 'insensitive' } },
        { addressTh: { contains: filters.query, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.twentyFourHours) {
    conditions.push({
      OR: [{ isEmergency24Hours: true }, { businessHours: { some: { is24Hours: true } } }],
    });
  }
  if (filters.openNow) {
    conditions.push({
      OR: [
        { isEmergency24Hours: true },
        {
          businessHours: {
            some: {
              weekday: dayNames[new Date().getDay()],
              OR: [{ is24Hours: true }, { isClosed: false }],
            },
          },
        },
      ],
    });
  }
  return {
    isVisible: true,
    deletedAt: null,
    status: { not: 'PENDING' },
    ...(conditions.length ? { AND: conditions } : {}),
    ...(filters.province
      ? { province: { OR: [{ code: filters.province }, { slug: filters.province }] } }
      : {}),
    ...(filters.district
      ? {
          district: {
            OR: [
              { code: filters.district },
              { nameEn: { equals: filters.district, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
    ...(filters.verifiedOnly ? { status: 'VERIFIED' } : {}),
    ...(filters.minimumRating ? { averageRating: { gte: filters.minimumRating } } : {}),
    ...(filters.bbox
      ? {
          longitude: { gte: filters.bbox[0], lte: filters.bbox[2] },
          latitude: { gte: filters.bbox[1], lte: filters.bbox[3] },
        }
      : {}),
  };
}

export async function findPublicPlaces(filters: MapFilters = {}, page = { skip: 0, take: 750 }) {
  const places = await prisma.place.findMany({
    where: publicPlaceWhere(filters),
    include,
    take: Math.min(750, page.take),
    skip: page.skip,
    orderBy: [{ trustScore: 'desc' }, { id: 'asc' }],
  });
  return places.map(toSummary);
}

export async function publicPlaceStats(filters: MapFilters = {}) {
  const where = publicPlaceWhere(filters);
  const [places, provinces, categories] = await prisma.$transaction([
    prisma.place.findMany({
      where,
      select: {
        provinceId: true,
        categoryId: true,
        additionalCategories: { select: { id: true } },
      },
    }),
    prisma.province.findMany({ select: { id: true, code: true } }),
    prisma.category.findMany({ select: { id: true, code: true } }),
  ]);
  const counts: Record<string, number> = Object.fromEntries(provinces.map((p) => [p.code, 0]));
  const facets: Record<string, number> = Object.fromEntries(categories.map((c) => [c.code, 0]));
  const provinceCodes = new Map(provinces.map((item) => [item.id, item.code]));
  const categoryCodes = new Map(categories.map((item) => [item.id, item.code]));
  for (const place of places) {
    const province = provinceCodes.get(place.provinceId)!;
    counts[province] = (counts[province] ?? 0) + 1;
    for (const id of new Set([
      place.categoryId,
      ...place.additionalCategories.map((item) => item.id),
    ])) {
      const code = categoryCodes.get(id)!;
      facets[code] = (facets[code] ?? 0) + 1;
    }
  }
  return { total: places.length, provinces: counts, facets };
}

export async function findPublicMapPoints(filters: MapFilters, cursor = 0) {
  const rows = await prisma.place.findMany({
    where: publicPlaceWhere(filters),
    orderBy: { id: 'asc' },
    skip: cursor,
    take: 751,
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      latitude: true,
      longitude: true,
      province: { select: { code: true } },
      category: { select: { code: true, color: true } },
      additionalCategories: { select: { code: true } },
    },
  });
  const items: MapPoint[] = rows.slice(0, 750).map((place) => ({
    id: place.id,
    slug: place.slug,
    nameTh: place.nameTh,
    nameEn: place.nameEn || place.nameTh,
    latitude: place.latitude,
    longitude: place.longitude,
    provinceCode: place.province.code,
    categoryCode: place.category.code as MapPoint['categoryCode'],
    categoryColor: place.category.color,
    categoryCodes: [
      ...new Set([place.category.code, ...place.additionalCategories.map((item) => item.code)]),
    ] as MapPoint['categoryCodes'],
  }));
  return { items, nextCursor: rows.length > 750 ? cursor + 750 : null };
}

export async function getPublicPlace(slugOrId: string) {
  const place = await prisma.place.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
      isVisible: true,
      deletedAt: null,
      status: { not: 'PENDING' },
    },
    include,
  });
  return place ? toSummary(place) : null;
}

export async function findNearbyPublicPlaces(
  provinceCode: string,
  excludePlaceId: string,
  take = 3,
) {
  const places = await prisma.place.findMany({
    where: {
      ...publicPlaceWhere({ province: provinceCode }),
      id: { not: excludePlaceId },
    },
    include,
    take,
    orderBy: [{ trustScore: 'desc' }, { id: 'asc' }],
  });
  return places.map(toSummary);
}
