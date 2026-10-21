import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getObject } from '@/lib/object-storage';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^meetup_[a-f0-9-]+\.(jpg|png|webp)$/u.test(key))
    return NextResponse.json({ error: 'INVALID_KEY' }, { status: 400 });
  const cover = await prisma.meetup.findUnique({
    where: { coverObjectKey: key },
    include: { place: { select: { isVisible: true, status: true, deletedAt: true } } },
  });
  let allowed = Boolean(
    cover &&
      !cover.deletedAt &&
      cover.place.isVisible &&
      cover.place.status === 'VERIFIED' &&
      !cover.place.deletedAt,
  );
  if (!allowed) {
    const message = await prisma.meetupMessage.findUnique({
      where: { objectKey: key },
      select: { meetupId: true, deletedAt: true },
    });
    if (message && !message.deletedAt) {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session && !session.user.suspendedAt) {
        const activeUser = await prisma.user.findFirst({
          where: { id: session.user.id, suspendedAt: null, deletedAt: null },
        });
        allowed = Boolean(
          activeUser &&
            (await prisma.meetup.findFirst({
              where: {
                id: message.meetupId,
                deletedAt: null,
                ...(activeUser.role === 'ADMIN'
                  ? {}
                  : { members: { some: { userId: activeUser.id, state: 'ACTIVE' } } }),
              },
            })),
        );
      }
    }
  }
  if (!allowed) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const object = await getObject(key);
    if (!object.Body) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    return new Response(new Blob([Uint8Array.from(bytes)]), {
      headers: {
        'Content-Type': key.endsWith('.png')
          ? 'image/png'
          : key.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
}
