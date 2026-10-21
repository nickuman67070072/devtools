import { fileTypeFromBuffer } from 'file-type';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { canWriteMeetupChat } from '@/features/meetups/service';
import { notifyMeetupChat } from '@/features/meetups/chat-notifications';
import { deleteObject, putObject } from '@/lib/object-storage';
import { hasTrustedOrigin } from '@/lib/origin';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';

const extensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > 6 * 1024 * 1024)
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.suspendedAt)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, suspendedAt: null, deletedAt: null },
  });
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const scope = form.get('scope');
  if (!(file instanceof File) || (scope !== 'cover' && scope !== 'chat'))
    return NextResponse.json({ error: 'INVALID_UPLOAD' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
  const meetup = await prisma.meetup.findFirst({
    where: { id, deletedAt: null },
    include: { members: { where: { userId: user.id, state: 'ACTIVE' } } },
  });
  if (!meetup) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (scope === 'cover' && meetup.hostId !== user.id && user.role !== 'ADMIN')
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (scope === 'chat' && !meetup.members.length && user.role !== 'ADMIN')
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (scope === 'chat' && !canWriteMeetupChat(meetup.status, meetup.endsAt))
    return NextResponse.json({ error: 'CHAT_READ_ONLY' }, { status: 409 });
  if (scope === 'cover' && (meetup.startsAt <= new Date() || meetup.status === 'CANCELLED'))
    return NextResponse.json({ error: 'MEETUP_NOT_EDITABLE' }, { status: 409 });
  const limit = await consumeRateLimit({
    key: user.id,
    action: 'meetup-upload',
    limit: 20,
    windowMs: 3_600_000,
  });
  if (!limit.allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  const extension = detected && extensions.get(detected.mime);
  if (!detected || !extension)
    return NextResponse.json({ error: 'INVALID_IMAGE_TYPE' }, { status: 415 });
  const key = `meetup_${crypto.randomUUID()}.${extension}`;
  await putObject(key, bytes, detected.mime);
  try {
    if (scope === 'cover') {
      await prisma.meetup.update({
        where: { id },
        data: { coverObjectKey: key, version: { increment: 1 } },
      });
      if (meetup.coverObjectKey) await deleteObject(meetup.coverObjectKey).catch(() => undefined);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.meetupMessage.create({
          data: { meetupId: id, authorId: user.id, kind: 'IMAGE', objectKey: key },
        });
        const members = await tx.meetupMember.findMany({
          where: { meetupId: id, state: 'ACTIVE' },
          select: { userId: true },
        });
        await notifyMeetupChat(
          tx,
          id,
          user.id,
          user.name,
          members.map((member) => member.userId),
        );
      });
    }
    return NextResponse.json({ mediaUrl: `/api/meetups/media/${key}` }, { status: 201 });
  } catch {
    await deleteObject(key).catch(() => undefined);
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 });
  }
}
