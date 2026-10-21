import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: async () =>
    session.userId ? { user: { id: session.userId, suspendedAt: null } } : null,
}));

import {
  cancelMeetupJoinRequest,
  decideMeetupJoinRequest,
  joinMeetup,
  markMeetupChatRead,
  sendMeetupMessage,
  setUserBlocked,
} from '@/features/meetups/actions';
import { canAccessMeetupChat } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

describe('Meetup join approval', () => {
  const prefix = `join-request-${randomUUID()}`;
  const users = {
    host: `${prefix}-host`,
    first: `${prefix}-first`,
    second: `${prefix}-second`,
    outsider: `${prefix}-outsider`,
  };
  let meetupId = '';
  let placeId = '';

  beforeAll(async () => {
    const place = await createPublicPlaceFixture(prisma, `${prefix}-fixture`);
    placeId = place.id;
    await prisma.user.createMany({
      data: Object.entries(users).map(([role, id]) => ({
        id,
        name: `${prefix} ${role}`,
        email: `${id}@pawmap.local`,
      })),
    });
    meetupId = (
      await prisma.meetup.create({
        data: {
          title: prefix,
          description: 'Integration fixture for join approval.',
          hostId: users.host,
          placeId: place.id,
          startsAt: new Date(Date.now() + 2 * 86_400_000),
          endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000),
          maxMembers: 2,
          members: { create: { userId: users.host } },
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (meetupId) {
      await prisma.auditLog.deleteMany({ where: { entityType: 'Meetup', entityId: meetupId } });
      await prisma.meetup.deleteMany({ where: { id: meetupId, title: prefix } });
    }
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.rateLimitBucket.deleteMany({
      where: { bucketKey: { in: Object.values(users) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  });

  it('requires login and keeps requests out of seats and chat', async () => {
    expect(await joinMeetup(meetupId)).toMatchObject({
      ok: false,
      formError: 'MEETUP_LOGIN_REQUIRED',
    });
    session.userId = users.first;
    expect((await joinMeetup(meetupId)).ok).toBe(true);
    expect(await joinMeetup(meetupId)).toMatchObject({
      ok: false,
      formError: 'MEETUP_REQUEST_PENDING',
    });
    expect(await prisma.meetupMember.count({ where: { meetupId, state: 'ACTIVE' } })).toBe(1);
    expect(await canAccessMeetupChat(meetupId, users.first, false)).toBeNull();
    expect(
      await prisma.meetupJoinRequest.findUniqueOrThrow({
        where: { meetupId_userId: { meetupId, userId: users.first } },
      }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('lets only the host decide, and lets a declined user request again or cancel', async () => {
    session.userId = users.second;
    expect((await joinMeetup(meetupId)).ok).toBe(true);
    const secondRequest = await prisma.meetupJoinRequest.findUniqueOrThrow({
      where: { meetupId_userId: { meetupId, userId: users.second } },
    });
    session.userId = users.outsider;
    expect(await decideMeetupJoinRequest(meetupId, secondRequest.id, 'APPROVED')).toMatchObject({
      ok: false,
      formError: 'MEETUP_FORBIDDEN',
    });
    session.userId = users.host;
    expect((await decideMeetupJoinRequest(meetupId, secondRequest.id, 'DECLINED')).ok).toBe(true);
    session.userId = users.second;
    expect((await joinMeetup(meetupId)).ok).toBe(true);
    expect((await cancelMeetupJoinRequest(meetupId)).ok).toBe(true);
    expect(await canAccessMeetupChat(meetupId, users.second, false)).toBeNull();
    expect((await joinMeetup(meetupId)).ok).toBe(true);
  });

  it('approves only one request for the final seat, including concurrent decisions', async () => {
    const requests = await prisma.meetupJoinRequest.findMany({
      where: { meetupId, status: 'PENDING' },
      orderBy: { userId: 'asc' },
    });
    expect(requests).toHaveLength(2);
    session.userId = users.host;
    const outcomes = await Promise.all(
      requests.map((request) => decideMeetupJoinRequest(meetupId, request.id, 'APPROVED')),
    );
    expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.meetupMember.count({ where: { meetupId, state: 'ACTIVE' } })).toBe(2);
    const approved = await prisma.meetupJoinRequest.findFirstOrThrow({
      where: { meetupId, status: 'APPROVED' },
    });
    expect(await canAccessMeetupChat(meetupId, approved.userId, false)).not.toBeNull();
    const waiting = await prisma.meetupJoinRequest.findFirstOrThrow({
      where: { meetupId, status: 'PENDING' },
    });
    expect(await canAccessMeetupChat(meetupId, waiting.userId, false)).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { entityType: 'Meetup', entityId: meetupId, action: 'MEETUP_JOIN_APPROVED' },
      }),
    ).toBe(1);
  });

  it('notifies the recipient of a new message, then respects read and block state', async () => {
    const approved = await prisma.meetupJoinRequest.findFirstOrThrow({
      where: { meetupId, status: 'APPROVED' },
    });
    session.userId = users.host;
    expect((await sendMeetupMessage(meetupId, 'First chat notification')).ok).toBe(true);
    const chatLink = `/meetups/${meetupId}/chat`;
    expect(
      await prisma.notification.count({
        where: { userId: approved.userId, link: chatLink, readAt: null },
      }),
    ).toBe(1);
    session.userId = approved.userId;
    expect((await markMeetupChatRead(meetupId)).ok).toBe(true);
    expect(
      await prisma.notification.count({
        where: { userId: approved.userId, link: chatLink, readAt: null },
      }),
    ).toBe(0);
    expect((await setUserBlocked(users.host, true)).ok).toBe(true);
    session.userId = users.host;
    expect((await sendMeetupMessage(meetupId, 'Blocked sender message')).ok).toBe(true);
    expect(
      await prisma.notification.count({
        where: { userId: approved.userId, link: chatLink, readAt: null },
      }),
    ).toBe(0);
  });

  it('expires unresolved requests when the activity starts', async () => {
    await prisma.meetup.update({
      where: { id: meetupId },
      data: {
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 3_600_000),
      },
    });
    execFileSync(process.execPath, ['infra/workers/meetup-worker.mjs', '--once'], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 15_000,
    });
    expect(
      await prisma.meetupJoinRequest.count({
        where: { meetupId, status: 'EXPIRED' },
      }),
    ).toBe(1);
  });
});
