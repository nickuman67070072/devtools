import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.suspendedAt)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, suspendedAt: null, deletedAt: null },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const [count, rows] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        titleTh: true,
        titleEn: true,
        bodyTh: true,
        bodyEn: true,
        link: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);
  return NextResponse.json(
    {
      count,
      items: rows.map((item) => ({
        id: item.id,
        titleTh: item.titleTh,
        titleEn: item.titleEn,
        bodyTh: item.bodyTh,
        bodyEn: item.bodyEn,
        link: item.link,
        kind:
          item.metadata &&
          typeof item.metadata === 'object' &&
          !Array.isArray(item.metadata) &&
          item.metadata.kind === 'MEETUP_CHAT'
            ? 'CHAT'
            : 'GENERAL',
        createdAt: item.createdAt.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
