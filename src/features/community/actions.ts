'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';
import { calculateTrustScore } from '@/lib/trust-score';
import { firstFieldErrors, plainText } from '@/lib/validation';

export async function toggleFavorite(placeId: string): Promise<ActionResult<{ active: boolean }>> {
  const session = await requireUser();
  const place = await prisma.place.findFirst({
    where: { id: placeId, isVisible: true, deletedAt: null },
  });
  if (!place) return { ok: false, formError: 'ไม่พบสถานที่' };
  const existing = await prisma.favorite.findFirst({
    where: { placeId, userId: session.user.id, collectionId: null },
  });
  if (existing) await prisma.favorite.delete({ where: { id: existing.id } });
  else await prisma.favorite.create({ data: { placeId, userId: session.user.id } });
  revalidatePath('/favorites');
  return { ok: true, data: { active: !existing } };
}

const reviewSchema = z.object({
  placeId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  cleanlinessRating: z.number().int().min(1).max(5),
  convenienceRating: z.number().int().min(1).max(5),
  petFriendlinessRating: z.number().int().min(1).max(5),
  content: plainText(10, 2_000),
  imageKeys: z.array(z.string()).max(4),
});

export async function saveReview(
  input: z.input<typeof reviewSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireUser();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const rate = await consumeRateLimit({
    key: session.user.id,
    action: 'review',
    limit: 5,
    windowMs: 3_600_000,
  });
  if (!rate.allowed) return { ok: false, formError: 'เขียนรีวิวได้ไม่เกิน 5 ครั้งต่อชั่วโมง' };
  const place = await prisma.place.findFirst({
    where: { id: parsed.data.placeId, isVisible: true, deletedAt: null },
  });
  if (!place) return { ok: false, formError: 'ไม่พบสถานที่' };

  const review = await prisma.$transaction(async (tx) => {
    const saved = await tx.review.upsert({
      where: { userId_placeId: { userId: session.user.id, placeId: place.id } },
      create: { ...parsed.data, imageKeys: undefined, userId: session.user.id },
      update: { ...parsed.data, imageKeys: undefined, deletedAt: null },
    });
    await tx.reviewImage.deleteMany({ where: { reviewId: saved.id, userId: session.user.id } });
    if (parsed.data.imageKeys.length) {
      await tx.reviewImage.createMany({
        data: parsed.data.imageKeys.map((objectKey, index) => ({
          reviewId: saved.id,
          userId: session.user.id,
          objectKey,
          alt: `Review image ${index + 1}`,
        })),
      });
    }
    const aggregate = await tx.review.aggregate({
      where: { placeId: place.id, isHidden: false, deletedAt: null },
      _avg: { rating: true },
      _count: true,
    });
    await tx.place.update({
      where: { id: place.id },
      data: { averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count },
    });
    return saved;
  });
  revalidatePath(`/places/${place.slug}`);
  return { ok: true, data: { id: review.id } };
}

export async function reportPlace(
  placeId: string,
  reason:
    | 'INCORRECT_INFORMATION'
    | 'TEMPORARILY_CLOSED'
    | 'PERMANENTLY_CLOSED'
    | 'DUPLICATE'
    | 'INAPPROPRIATE_CONTENT'
    | 'OTHER',
  details: string,
): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = plainText(10, 1_000).safeParse(details);
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: { details: parsed.error.issues.map((issue) => issue.message) },
    };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const duplicate = await prisma.report.findFirst({
    where: { placeId, reporterId: session.user.id, reason, createdAt: { gte: thirtyDaysAgo } },
  });
  if (duplicate) return { ok: false, formError: 'คุณรายงานเหตุผลนี้แล้วในช่วง 30 วันที่ผ่านมา' };
  await prisma.report.create({
    data: { placeId, reporterId: session.user.id, reason, details: parsed.data },
  });
  return { ok: true, data: undefined };
}

export async function verifyPlace(
  placeId: string,
  note: string,
): Promise<ActionResult<{ score: number }>> {
  const session = await requireUser();
  const existing = await prisma.verification.findFirst({
    where: {
      placeId,
      userId: session.user.id,
      createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
    },
  });
  if (existing) return { ok: false, formError: 'คุณยืนยันสถานที่นี้แล้วในช่วง 30 วันที่ผ่านมา' };
  await prisma.verification.create({
    data: {
      placeId,
      userId: session.user.id,
      note: note.trim().slice(0, 500),
      kind: session.user.role === 'ADMIN' ? 'ADMIN' : 'COMMUNITY',
    },
  });
  const [place, verifications, reports] = await Promise.all([
    prisma.place.findUniqueOrThrow({ where: { id: placeId } }),
    prisma.verification.findMany({ where: { placeId } }),
    prisma.report.count({
      where: {
        placeId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
        createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
    }),
  ]);
  const trust = calculateTrustScore({
    lastVerifiedAt: new Date(),
    confirmedReports: reports,
    verifications: verifications.map((item) => ({
      kind: item.kind,
      isConfirmed: item.isConfirmed,
      createdAt: item.createdAt,
      hasEvidence: Boolean(item.evidenceKey || item.evidenceUrl),
    })),
  });
  await prisma.place.update({
    where: { id: placeId },
    data: {
      lastVerifiedAt: new Date(),
      trustScore: trust.score,
      confidenceLevel: trust.level,
      status: trust.stale ? 'STALE' : place.status,
      trustFactors: trust.factors,
    },
  });
  revalidatePath(`/places/${place.slug}`);
  return { ok: true, data: { score: trust.score } };
}
