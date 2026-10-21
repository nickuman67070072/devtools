import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { canAccessMeetupChat } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.suspendedAt)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const meetup = await canAccessMeetupChat(id, session.user.id, session.user.role === 'ADMIN');
  if (!meetup) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const cursor = request.nextUrl.searchParams.get('before') ?? undefined;
  const blocked = await prisma.userBlock.findMany({
    where: { blockerId: session.user.id },
    select: { blockedId: true },
  });
  const blockedIds = new Set(blocked.map((item) => item.blockedId));
  const messages = await prisma.meetupMessage.findMany({
    where: { meetupId: id },
    include: {
      author: { select: { id: true, name: true } },
      replyTo: { select: { id: true, text: true, authorId: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 50,
  });
  const items = messages.reverse().map((message) => {
    const hidden =
      message.kind !== 'SYSTEM' &&
      !message.pinnedAt &&
      Boolean(message.authorId && blockedIds.has(message.authorId));
    return {
      id: message.id,
      kind: message.kind,
      text: hidden || message.deletedAt ? null : message.text,
      mediaUrl:
        hidden || message.deletedAt || !message.objectKey
          ? null
          : `/api/meetups/media/${encodeURIComponent(message.objectKey)}`,
      author: hidden ? null : message.author,
      authorId: message.authorId,
      blocked: hidden,
      deleted: Boolean(message.deletedAt),
      pinned: Boolean(message.pinnedAt),
      replyTo:
        hidden || (message.replyTo?.authorId && blockedIds.has(message.replyTo.authorId))
          ? null
          : message.replyTo,
      createdAt: message.createdAt.toISOString(),
    };
  });
  return NextResponse.json(
    { items, before: messages.length === 50 ? messages[0]?.id : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
