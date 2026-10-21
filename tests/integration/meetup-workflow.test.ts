import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { searchMeetupSchema, searchMeetups } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

describe('Meetup discovery contract', () => {
  const fixturePrefix = `meetup-discovery-${randomUUID()}`;
  let meetupId = '';
  let placeId = '';
  let latitude = 0;
  let longitude = 0;
  let guestId = '';

  beforeAll(async () => {
    const [host, guest, place] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: credentials.user.email } }),
      prisma.user.findUniqueOrThrow({ where: { email: credentials.admin.email } }),
      createPublicPlaceFixture(prisma, fixturePrefix),
    ]);
    placeId = place.id;
    latitude = place.latitude;
    longitude = place.longitude;
    guestId = guest.id;
    const meetup = await prisma.meetup.create({
      data: {
        title: 'Meetup integration discovery fixture',
        description: 'Checks public filtering and calculated capacity.',
        hostId: host.id,
        placeId,
        startsAt: new Date(Date.now() + 2 * 86_400_000),
        endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000),
        maxMembers: 2,
        members: { create: { userId: host.id } },
      },
    });
    meetupId = meetup.id;
  });

  afterAll(async () => {
    if (meetupId) {
      await prisma.meetup.deleteMany({
        where: { id: meetupId, title: 'Meetup integration discovery fixture' },
      });
    }
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.$disconnect();
  });

  it('returns only nearby public information without exposing member identities', async () => {
    const nearby = await searchMeetups(
      searchMeetupSchema.parse({ placeId, latitude, longitude, radiusKm: 1 }),
    );
    const card = nearby.items.find((item) => item.id === meetupId);
    expect(card).toMatchObject({ status: 'OPEN', memberCount: 1, maxMembers: 2 });
    expect(card?.distanceKm).toBe(0);
    expect(JSON.stringify(card)).not.toContain(credentials.user.email);
    expect(JSON.stringify(card)).not.toContain(guestId);

    const farAway = await searchMeetups(
      searchMeetupSchema.parse({ placeId, latitude: 0, longitude: 0, radiusKm: 1 }),
    );
    expect(farAway.items.some((item) => item.id === meetupId)).toBe(false);
  });

  it('searches activity text and restores all eligible results when the query is empty', async () => {
    const match = await searchMeetups(searchMeetupSchema.parse({ q: 'integration discovery' }));
    expect(match.items.some((item) => item.id === meetupId)).toBe(true);
    const miss = await searchMeetups(searchMeetupSchema.parse({ q: 'no-match-activity-9981' }));
    expect(miss.items.some((item) => item.id === meetupId)).toBe(false);
    const cleared = await searchMeetups(searchMeetupSchema.parse({ q: '   ' }));
    expect(cleared.items.some((item) => item.id === meetupId)).toBe(true);
  });

  it('derives FULL from active membership and reopens when capacity is freed', async () => {
    await prisma.meetupMember.create({ data: { meetupId, userId: guestId } });
    const full = await searchMeetups(searchMeetupSchema.parse({ placeId }));
    expect(full.items.find((item) => item.id === meetupId)?.status).toBe('FULL');
    const available = await searchMeetups(searchMeetupSchema.parse({ placeId, hasSpace: true }));
    expect(available.items.some((item) => item.id === meetupId)).toBe(false);

    await prisma.meetupMember.update({
      where: { meetupId_userId: { meetupId, userId: guestId } },
      data: { state: 'LEFT', leftAt: new Date() },
    });
    const reopened = await searchMeetups(searchMeetupSchema.parse({ placeId, hasSpace: true }));
    expect(reopened.items.find((item) => item.id === meetupId)?.status).toBe('OPEN');
  });

  it('removes soft-deleted Meetup from discovery', async () => {
    await prisma.meetup.update({ where: { id: meetupId }, data: { deletedAt: new Date() } });
    const result = await searchMeetups(searchMeetupSchema.parse({ placeId }));
    expect(result.items.some((item) => item.id === meetupId)).toBe(false);
  });
});
