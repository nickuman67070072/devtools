'use server';

import { Prisma, SubmissionKind, SubmissionStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';
import { firstFieldErrors, plainText, activeCategoryCode } from '@/lib/validation';

const submissionSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(SubmissionKind).default(SubmissionKind.CREATE),
  targetPlaceId: z.string().optional(),
  nameTh: plainText(2, 160),
  nameEn: plainText(0, 160).optional().or(z.literal('')),
  descriptionTh: plainText(20, 2_000),
  descriptionEn: plainText(0, 2_000).optional().or(z.literal('')),
  addressTh: plainText(5, 500),
  provinceCode: z.string().min(1),
  districtCode: z.string().optional(),
  categoryCode: activeCategoryCode,
  latitude: z.coerce.number().min(5).max(21),
  longitude: z.coerce.number().min(97).max(106),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().url().max(500).optional().or(z.literal('')),
  petTypes: z.array(z.enum(['DOG', 'CAT', 'SMALL_PET', 'BIRD', 'EXOTIC'])).min(1),
  indoorAllowed: z.boolean(),
  outdoorAllowed: z.boolean(),
  leashRequired: z.boolean(),
  open24Hours: z.boolean(),
  imageKeys: z.array(z.string()).max(8),
});

export type SubmissionInput = z.input<typeof submissionSchema>;

function normalizeName(value: string) {
  return value
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export async function saveSubmission(
  input: SubmissionInput,
  intent: 'draft' | 'submit',
): Promise<ActionResult<{ id: string; status: SubmissionStatus; duplicateCount: number }>> {
  const session = await requireUser();
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  if (intent === 'submit') {
    const rate = await consumeRateLimit({
      key: session.user.id,
      action: 'submission',
      limit: 10,
      windowMs: 3_600_000,
    });
    if (!rate.allowed)
      return { ok: false, formError: 'ส่งข้อมูลได้ไม่เกิน 10 ครั้งต่อชั่วโมง กรุณาลองใหม่ภายหลัง' };
  }

  const data = parsed.data;
  const [province, district, category] = await Promise.all([
    prisma.province.findUnique({ where: { code: data.provinceCode } }),
    data.districtCode
      ? prisma.district.findFirst({
          where: { code: data.districtCode, province: { code: data.provinceCode } },
        })
      : null,
    prisma.category.findUnique({ where: { code: data.categoryCode } }),
  ]);
  if (!province || !category) return { ok: false, formError: 'จังหวัดหรือหมวดหมู่ไม่ถูกต้อง' };
  if (data.districtCode && !district)
    return { ok: false, formError: 'อำเภอไม่สัมพันธ์กับจังหวัดที่เลือก' };

  const normalized = normalizeName(data.nameTh);
  const duplicateCandidates = await prisma
    .$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
    SELECT id FROM places
    WHERE "provinceId" = ${province.id}
      AND "deletedAt" IS NULL
      AND (
        similarity(lower("nameTh"), ${normalized}) > 0.55
        OR (6371000 * acos(least(1, cos(radians(${data.latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${data.longitude})) + sin(radians(${data.latitude})) * sin(radians(latitude))))) <= 500
      )
    LIMIT 8
  `,
    )
    .catch(() => []);

  const proposedData = {
    nameTh: data.nameTh,
    nameEn: data.nameEn || null,
    descriptionTh: data.descriptionTh,
    descriptionEn: data.descriptionEn || null,
    addressTh: data.addressTh,
    latitude: data.latitude,
    longitude: data.longitude,
    phone: data.phone || null,
    website: data.website || null,
    petTypes: data.petTypes,
    indoorAllowed: data.indoorAllowed,
    outdoorAllowed: data.outdoorAllowed,
    leashRequired: data.leashRequired,
    open24Hours: data.open24Hours,
  } satisfies Prisma.InputJsonObject;

  const existing = data.id
    ? await prisma.submission.findFirst({
        where: { id: data.id, submitterId: session.user.id, deletedAt: null },
      })
    : null;
  if (data.id && !existing) return { ok: false, formError: 'ไม่พบฉบับร่างหรือคุณไม่มีสิทธิ์แก้ไข' };
  if (existing && !['DRAFT', 'NEEDS_REVISION', 'PENDING'].includes(existing.status)) {
    return { ok: false, formError: 'รายการนี้สิ้นสุดการพิจารณาแล้ว' };
  }

  const originalSnapshot =
    data.kind === 'UPDATE' && data.targetPlaceId
      ? await prisma.place
          .findFirst({ where: { id: data.targetPlaceId, deletedAt: null } })
          .then((place) =>
            place
              ? ({
                  version: place.version,
                  nameTh: place.nameTh,
                  descriptionTh: place.descriptionTh,
                  addressTh: place.addressTh,
                  latitude: place.latitude,
                  longitude: place.longitude,
                } satisfies Prisma.InputJsonObject)
              : null,
          )
      : null;

  const status = intent === 'submit' ? SubmissionStatus.PENDING : SubmissionStatus.DRAFT;
  const revision =
    existing && existing.status !== 'DRAFT' ? existing.revision + 1 : (existing?.revision ?? 1);
  const submission = existing
    ? await prisma.submission.update({
        where: { id: existing.id },
        data: {
          kind: data.kind,
          targetPlaceId: data.targetPlaceId || null,
          proposedData,
          originalSnapshot: existing.originalSnapshot ?? originalSnapshot ?? Prisma.JsonNull,
          provinceId: province.id,
          districtId: district?.id ?? null,
          categoryId: category.id,
          status,
          revision,
          submittedAt: intent === 'submit' ? new Date() : null,
          adminMessage: intent === 'submit' ? null : existing.adminMessage,
        },
      })
    : await prisma.submission.create({
        data: {
          kind: data.kind,
          targetPlaceId: data.targetPlaceId || null,
          proposedData,
          originalSnapshot: originalSnapshot ?? Prisma.JsonNull,
          provinceId: province.id,
          districtId: district?.id ?? null,
          categoryId: category.id,
          submitterId: session.user.id,
          status,
          submittedAt: intent === 'submit' ? new Date() : null,
        },
      });

  await prisma.submissionImage.deleteMany({ where: { submissionId: submission.id } });
  if (data.imageKeys.length) {
    await prisma.submissionImage.createMany({
      data: data.imageKeys.map((objectKey, index) => ({
        submissionId: submission.id,
        objectKey,
        altTh: `ภาพประกอบสถานที่ ${data.nameTh} ลำดับที่ ${index + 1}`,
        sortOrder: index,
        isCover: index === 0,
      })),
    });
  }
  revalidatePath('/contributions');
  revalidatePath('/admin/submissions');
  return {
    ok: true,
    data: { id: submission.id, status, duplicateCount: duplicateCandidates.length },
  };
}

export async function deleteSubmission(id: string): Promise<ActionResult> {
  const session = await requireUser();
  const submission = await prisma.submission.findFirst({
    where: {
      id,
      submitterId: session.user.id,
      status: { in: ['DRAFT', 'PENDING', 'NEEDS_REVISION'] },
      deletedAt: null,
    },
  });
  if (!submission) return { ok: false, formError: 'ไม่พบรายการที่ลบได้' };
  await prisma.submission.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/contributions');
  revalidatePath('/admin/submissions');
  return { ok: true, data: undefined };
}
