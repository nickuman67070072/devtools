import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { distanceKm, effectiveMeetupStatus } from './utils';
export { canWriteMeetupChat, distanceKm, effectiveMeetupStatus } from './utils';

const availablePlace = {
  isVisible: true,
  deletedAt: null,
  status: 'VERIFIED' as const,
};

export const createMeetupSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(4000),
  rules: z.string().trim().max(2000).optional(),
  placeId: z.string().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  maxMembers: z.number().int().min(2).max(50),
});

export const searchMeetupSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(0.1).max(100).default(10),
    date: z.iso.date().optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .optional(),
    province: z.string().trim().max(80).optional(),
    placeId: z.string().optional(),
    category: z.string().trim().max(80).optional(),
    q: z.string().trim().max(120).optional(),
    hasSpace: z.boolean().optional(),
    sort: z.enum(['soon', 'latest']).default('soon'),
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(30).default(12),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: 'Both coordinates are required',
    path: ['latitude'],
  });

export type MeetupSearch = z.infer<typeof searchMeetupSchema>;

const cardInclude = {
  place: { include: { province: true, category: true } },
  host: { select: { id: true, name: true } },
  _count: { select: { members: { where: { state: 'ACTIVE' as const } } } },
} satisfies Prisma.MeetupInclude;

export async function searchMeetups(input: MeetupSearch) {
  const now = new Date();
  const hasCenter = input.latitude !== undefined && input.longitude !== undefined;
  const startDay = input.date ? new Date(`${input.date}T00:00:00+07:00`) : undefined;
  const endDay = input.date ? new Date(startDay!.getTime() + 86_400_000) : undefined;
  const matches = await prisma.meetup.findMany({
    where: {
      deletedAt: null,
      status: { in: ['OPEN', 'CLOSED'] },
      startsAt: { gt: now, ...(startDay ? { gte: startDay, lt: endDay } : {}) },
      place: {
        ...availablePlace,
        ...(input.province
          ? { province: { OR: [{ code: input.province }, { slug: input.province }] } }
          : {}),
        ...(input.category
          ? {
              OR: [
                { category: { code: input.category } },
                { additionalCategories: { some: { code: input.category } } },
              ],
            }
          : {}),
      },
      ...(input.placeId ? { placeId: input.placeId } : {}),
      ...(input.q
        ? {
            OR: [
              { title: { contains: input.q, mode: 'insensitive' as const } },
              { description: { contains: input.q, mode: 'insensitive' as const } },
              { place: { nameTh: { contains: input.q, mode: 'insensitive' as const } } },
              { place: { nameEn: { contains: input.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    include: cardInclude,
    orderBy: input.sort === 'latest' ? { createdAt: 'desc' } : { startsAt: 'asc' },
  });
  const filtered = matches.flatMap((meetup) => {
    const memberCount = meetup._count.members;
    if (input.hasSpace && (meetup.status !== 'OPEN' || memberCount >= meetup.maxMembers)) return [];
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(meetup.startsAt);
    if (input.time && localTime < input.time) return [];
    const km = hasCenter
      ? distanceKm(input.latitude!, input.longitude!, meetup.place.latitude, meetup.place.longitude)
      : null;
    if (km !== null && km > input.radiusKm) return [];
    return [
      {
        id: meetup.id,
        title: meetup.title,
        startsAt: meetup.startsAt.toISOString(),
        endsAt: meetup.endsAt.toISOString(),
        status: effectiveMeetupStatus(
          meetup.status,
          meetup.startsAt,
          meetup.endsAt,
          memberCount,
          meetup.maxMembers,
          now,
        ),
        memberCount,
        maxMembers: meetup.maxMembers,
        distanceKm: km === null ? null : Math.round(km * 10) / 10,
        place: {
          id: meetup.place.id,
          slug: meetup.place.slug,
          nameTh: meetup.place.nameTh,
          nameEn: meetup.place.nameEn,
          latitude: meetup.place.latitude,
          longitude: meetup.place.longitude,
          provinceTh: meetup.place.province.nameTh,
          provinceEn: meetup.place.province.nameEn,
          categoryTh: meetup.place.category.nameTh,
          categoryEn: meetup.place.category.nameEn,
        },
      },
    ];
  });
  return {
    items: filtered.slice(input.cursor, input.cursor + input.limit),
    total: filtered.length,
    nextCursor: input.cursor + input.limit < filtered.length ? input.cursor + input.limit : null,
  };
}

export async function canAccessMeetupChat(meetupId: string, userId: string, isAdmin: boolean) {
  const activeUser = await prisma.user.findFirst({
    where: { id: userId, suspendedAt: null, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!activeUser) return null;
  isAdmin = isAdmin && activeUser.role === 'ADMIN';
  if (isAdmin) return prisma.meetup.findFirst({ where: { id: meetupId, deletedAt: null } });
  return prisma.meetup.findFirst({
    where: { id: meetupId, deletedAt: null, members: { some: { userId, state: 'ACTIVE' } } },
  });
}
