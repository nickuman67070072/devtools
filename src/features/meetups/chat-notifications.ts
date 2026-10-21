import 'server-only';

import type { Prisma } from '@prisma/client';

export async function notifyMeetupChat(
  tx: Prisma.TransactionClient,
  meetupId: string,
  senderId: string,
  senderName: string,
  memberIds: string[],
  important = false,
) {
  const recipients = [...new Set(memberIds)].filter((id) => id !== senderId);
  if (!recipients.length) return;
  const blocks = important
    ? []
    : await tx.userBlock.findMany({
        where: { blockerId: { in: recipients }, blockedId: senderId },
        select: { blockerId: true },
      });
  const blockedIds = new Set(blocks.map((block) => block.blockerId));
  await tx.notification.createMany({
    data: recipients
      .filter((id) => !blockedIds.has(id))
      .map((userId) => ({
        userId,
        type: 'MEETUP',
        titleTh: important ? 'ประกาศจากหัวกลุ่ม' : 'ข้อความใหม่ในแชต Meetup',
        titleEn: important ? 'Host announcement' : 'New Meetup chat message',
        bodyTh: `${senderName} ส่งข้อความใหม่`,
        bodyEn: `${senderName} sent a new message`,
        link: `/meetups/${meetupId}/chat`,
        metadata: { kind: 'MEETUP_CHAT', meetupId },
      })),
  });
}
