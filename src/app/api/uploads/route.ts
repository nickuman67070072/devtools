import { fileTypeFromBuffer } from 'file-type';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { putObject } from '@/lib/object-storage';
import { hasTrustedOrigin } from '@/lib/origin';
import { prisma } from '@/lib/prisma';

const allowed = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.suspendedAt)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const scope = form.get('scope') === 'review' ? 'review' : 'submission';
  const entityId = String(form.get('entityId') ?? '');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'Image exceeds 5 MB' }, { status: 413 });

  const maxFiles = scope === 'review' ? 4 : 8;
  if (entityId) {
    const count =
      scope === 'review'
        ? await prisma.reviewImage.count({ where: { reviewId: entityId, userId: session.user.id } })
        : await prisma.submissionImage.count({
            where: { submissionId: entityId, submission: { submitterId: session.user.id } },
          });
    if (count >= maxFiles)
      return NextResponse.json({ error: `Upload limit is ${maxFiles} images` }, { status: 409 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  const extension = detected ? allowed.get(detected.mime) : undefined;
  if (!detected || !extension) {
    return NextResponse.json(
      { error: 'Only genuine JPEG, PNG, and WebP images are accepted' },
      { status: 415 },
    );
  }
  const objectKey = `${scope}_${session.user.id}_${crypto.randomUUID()}.${extension}`;
  await putObject(objectKey, bytes, detected.mime);
  return NextResponse.json(
    { objectKey, mediaUrl: `/api/media/${encodeURIComponent(objectKey)}` },
    { status: 201 },
  );
}
