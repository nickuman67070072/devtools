import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let stopping = false;

process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

async function tick() {
  const now = new Date();
  await prisma.meetupJoinRequest.updateMany({
    where: {
      status: 'PENDING',
      meetup: {
        OR: [{ startsAt: { lte: now } }, { status: 'CANCELLED' }, { deletedAt: { not: null } }],
      },
    },
    data: { status: 'EXPIRED', decidedAt: now },
  });
  await prisma.meetup.updateMany({
    where: {
      deletedAt: null,
      status: { in: ['OPEN', 'CLOSED'] },
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    data: { status: 'ONGOING' },
  });
  await prisma.meetup.updateMany({
    where: { deletedAt: null, status: { in: ['OPEN', 'CLOSED', 'ONGOING'] }, endsAt: { lte: now } },
    data: { status: 'COMPLETED' },
  });
  const upcoming = await prisma.meetup.findMany({
    where: {
      deletedAt: null,
      status: { in: ['OPEN', 'CLOSED'] },
      reminderSentAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + 60 * 60 * 1000) },
    },
    select: {
      id: true,
      startsAt: true,
      members: { where: { state: 'ACTIVE' }, select: { userId: true } },
    },
    take: 100,
  });
  for (const meetup of upcoming) {
    await prisma
      .$transaction(async (tx) => {
        const claimed = await tx.meetup.updateMany({
          where: { id: meetup.id, reminderSentAt: null },
          data: { reminderSentAt: now },
        });
        if (!claimed.count) return;
        await tx.meetupNotificationEvent.create({
          data: { meetupId: meetup.id, eventKey: `starting-soon-${meetup.startsAt.toISOString()}` },
        });
        if (meetup.members.length)
          await tx.notification.createMany({
            data: meetup.members.map((member) => ({
              userId: member.userId,
              type: 'MEETUP',
              titleTh: 'Meetup ใกล้เริ่มแล้ว',
              titleEn: 'Meetup starting soon',
              bodyTh: 'กิจกรรมที่คุณเข้าร่วมจะเริ่มภายในหนึ่งชั่วโมง',
              bodyEn: 'Your Meetup starts within an hour',
              link: `/meetups/${meetup.id}`,
            })),
          });
      })
      .catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
  }
}

if (process.argv.includes('--once')) {
  await tick();
} else {
  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      process.stderr.write(`${new Date().toISOString()} ${String(error)}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
}
await prisma.$disconnect();
