import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getObject } from '@/lib/object-storage';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^(submission|review)_[a-zA-Z0-9_-]+_[a-f0-9-]+\.(jpg|png|webp)$/u.test(key)) {
    return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const [placeImage, reviewImage, submissionImage] = await Promise.all([
    prisma.placeImage.findUnique({ where: { objectKey: key }, include: { place: true } }),
    prisma.reviewImage.findUnique({ where: { objectKey: key }, include: { review: true } }),
    prisma.submissionImage.findUnique({ where: { objectKey: key }, include: { submission: true } }),
  ]);

  const isAdmin = session?.user.role === 'ADMIN' && !session.user.suspendedAt;
  const embeddedOwnerId = key.split('_')[1];
  const isTemporaryOwner =
    !placeImage && !reviewImage && !submissionImage && session?.user.id === embeddedOwnerId;
  const canRead =
    (placeImage && placeImage.place.isVisible && placeImage.place.status !== 'PENDING') ||
    (reviewImage && !reviewImage.review.isHidden && !reviewImage.review.deletedAt) ||
    (submissionImage && (submissionImage.submission.submitterId === session?.user.id || isAdmin)) ||
    isTemporaryOwner ||
    isAdmin;
  if (!canRead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const object = await getObject(key);
    if (!object.Body) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    const mime = key.endsWith('.png')
      ? 'image/png'
      : key.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    return new Response(new Blob([Uint8Array.from(bytes)]), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': placeImage ? 'private, max-age=3600' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
