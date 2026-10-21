import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: async () => ({ user: { id: session.userId, suspendedAt: null } }),
}));

import {
  joinMeetup,
  leaveMeetup,
  moderateMeetupMember,
  reportMeetup,
  resolveMeetupReport,
  setUserBlocked,
  transferMeetupHost,
} from '@/features/meetups/actions';
import { canAccessMeetupChat } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

describe('Meetup host and moderation permissions', () => {
  const prefix = `meetup-moderation-${randomUUID()}`;
  const users = {
    host: `${prefix}-host`,
    successor: `${prefix}-successor`,
    target: `${prefix}-target`,
    outsider: `${prefix}-outsider`,
  };
  let meetupId = '';
  let placeId = '';
  let reportId = '';
  let adminId = '';

  beforeAll(async () => {
    const [place, admin] = await Promise.all([
      createPublicPlaceFixture(prisma, `${prefix}-fixture`),
      prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } }),
    ]);
    placeId = place.id;
    adminId = admin.id;
    await prisma.user.createMany({
      data: Object.entries(users).map(([role, id]) => ({
        id,
        name: `${prefix} ${role}`,
        email: `${id}@pawmap.local`,
      })),
    });
    const meetup = await prisma.meetup.create({
      data: {
        title: prefix,
        description: 'Integration fixture for host and moderation permissions.',
        startsAt: new Date(Date.now() + 2 * 86_400_000),
        endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000),
        maxMembers: 5,
        hostId: users.host,
        placeId: place.id,
        members: {
          create: [users.host, users.successor, users.target].map((userId) => ({ userId })),
        },
      },
    });
    meetupId = meetup.id;
  });

  afterAll(async () => {
    if (meetupId) {
      if (reportId) {
        await prisma.auditLog.deleteMany({
          where: { entityType: 'MeetupReport', entityId: reportId },
        });
      }
      await prisma.auditLog.deleteMany({
        where: { entityType: 'Meetup', entityId: meetupId },
      });
      await prisma.meetup.deleteMany({ where: { id: meetupId, title: prefix } });
    }
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.rateLimitBucket.deleteMany({
      where: { bucketKey: { in: Object.values(users) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  });

  it('keeps host-only operations unavailable to another user', async () => {
    session.userId = users.outsider;
    expect(await transferMeetupHost(meetupId, users.successor)).toMatchObject({
      ok: false,
      formError: 'MEETUP_FORBIDDEN',
    });
    expect(await moderateMeetupMember(meetupId, users.target, 'BAN')).toMatchObject({
      ok: false,
      formError: 'MEETUP_FORBIDDEN',
    });
    expect(await resolveMeetupReport('unknown', false)).toMatchObject({
      ok: false,
      formError: 'MEETUP_FORBIDDEN',
    });
  });

  it('requires the host to transfer ownership before leaving', async () => {
    session.userId = users.host;
    expect(await leaveMeetup(meetupId)).toMatchObject({
      ok: false,
      formError: 'MEETUP_TRANSFER_HOST_FIRST',
    });
    expect((await transferMeetupHost(meetupId, users.outsider)).ok).toBe(false);
    expect((await transferMeetupHost(meetupId, users.successor)).ok).toBe(true);
    expect((await leaveMeetup(meetupId)).ok).toBe(true);
    expect(await prisma.meetup.findUniqueOrThrow({ where: { id: meetupId } })).toMatchObject({
      hostId: users.successor,
    });
  });

  it('revokes chat and rejoin access for a banned member', async () => {
    session.userId = users.successor;
    expect((await moderateMeetupMember(meetupId, users.target, 'BAN')).ok).toBe(true);
    expect(
      await prisma.meetupMember.findUniqueOrThrow({
        where: { meetupId_userId: { meetupId, userId: users.target } },
      }),
    ).toMatchObject({ state: 'KICKED' });
    expect(
      await prisma.meetupBan.findUnique({
        where: { meetupId_userId: { meetupId, userId: users.target } },
      }),
    ).not.toBeNull();
    expect(await canAccessMeetupChat(meetupId, users.target, false)).toBeNull();
    session.userId = users.target;
    expect(await joinMeetup(meetupId)).toMatchObject({
      ok: false,
      formError: 'MEETUP_BANNED',
    });
    expect(
      await prisma.auditLog.count({
        where: { entityType: 'Meetup', entityId: meetupId, action: 'MEETUP_BAN' },
      }),
    ).toBe(1);
  });

  it('lets a user report and block while reserving report resolution for Admin', async () => {
    session.userId = users.host;
    expect(
      (
        await reportMeetup(meetupId, {
          target: 'MEETUP',
          targetId: meetupId,
          reason: 'OTHER',
          details: 'Integration report',
        })
      ).ok,
    ).toBe(true);
    reportId = (
      await prisma.meetupReport.findFirstOrThrow({
        where: { meetupId, reporterId: users.host },
      })
    ).id;
    expect((await setUserBlocked(users.target, true)).ok).toBe(true);
    expect(
      await prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: users.host, blockedId: users.target } },
      }),
    ).not.toBeNull();
    expect(await resolveMeetupReport(reportId, false)).toMatchObject({
      ok: false,
      formError: 'MEETUP_FORBIDDEN',
    });
    session.userId = adminId;
    expect((await resolveMeetupReport(reportId, false)).ok).toBe(true);
    expect(await prisma.meetupReport.findUniqueOrThrow({ where: { id: reportId } })).toMatchObject({
      status: 'RESOLVED',
    });
    expect(
      await prisma.auditLog.count({
        where: { entityType: 'MeetupReport', entityId: reportId, action: 'RESOLVE_MEETUP_REPORT' },
      }),
    ).toBe(1);
  });
});
