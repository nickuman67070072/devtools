'use server';

import { Prisma, type SubmissionStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { requireAdmin } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { plainText, activeCategoryCode } from '@/lib/validation';

type Decision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

const adminPlaceSchema = z.object({
  id: z.string().optional(),
  version: z.coerce.number().int().positive().optional(),
  nameTh: plainText(2, 160),
  nameEn: plainText(0, 160).optional().or(z.literal('')),
  descriptionTh: plainText(20, 2_000),
  addressTh: plainText(5, 500),
  provinceCode: z.string().min(1),
  categoryCode: activeCategoryCode,
  latitude: z.coerce.number().min(5).max(21),
  longitude: z.coerce.number().min(97).max(106),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().url().max(500).optional().or(z.literal('')),
  status: z.enum(['PENDING', 'VERIFIED', 'STALE', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED']),
  isVisible: z.boolean(),
});

export type AdminPlaceInput = z.input<typeof adminPlaceSchema>;

interface ProposedPlace {
  nameTh: string;
  nameEn?: string | null;
  descriptionTh: string;
  descriptionEn?: string | null;
  addressTh: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  petTypes: Array<'DOG' | 'CAT' | 'SMALL_PET' | 'BIRD' | 'EXOTIC'>;
  indoorAllowed: boolean;
  outdoorAllowed: boolean;
  leashRequired: boolean;
  open24Hours: boolean;
}

export async function setPlaceDeleted(placeId: string, deleted: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) return { ok: false, formError: 'ไม่พบสถานที่' };
  await prisma.$transaction([
    prisma.place.update({
      where: { id: placeId },
      data: {
        deletedAt: deleted ? new Date() : null,
        isVisible: !deleted,
        version: { increment: 1 },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: deleted ? 'SOFT_DELETE' : 'RESTORE',
        entityType: 'Place',
        entityId: placeId,
        oldValue: { deletedAt: place.deletedAt?.toISOString() ?? null },
        newValue: { deletedAt: deleted ? 'now' : null },
      },
    }),
  ]);
  revalidatePath('/admin/places');
  revalidatePath('/explore');
  return { ok: true, data: undefined };
}

export async function saveAdminPlace(
  input: AdminPlaceInput,
): Promise<ActionResult<{ id: string; version: number }>> {
  const session = await requireAdmin();
  const parsed = adminPlaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, formError: 'กรุณาตรวจชื่อ คำอธิบาย ที่อยู่ พิกัด และ URL ให้ถูกต้อง' };
  }
  const data = parsed.data;
  const [province, category] = await Promise.all([
    prisma.province.findUnique({ where: { code: data.provinceCode } }),
    prisma.category.findUnique({ where: { code: data.categoryCode } }),
  ]);
  if (!province || !category) return { ok: false, formError: 'ไม่พบจังหวัดหรือหมวดหมู่' };

  try {
    const saved = await prisma.$transaction(async (tx) => {
      if (data.id) {
        const previous = await tx.place.findUnique({ where: { id: data.id } });
        if (!previous) throw new Error('ไม่พบสถานที่');
        if (previous.version !== data.version) {
          throw new Error('ข้อมูลถูกแก้ไขโดยผู้ดูแลคนอื่น กรุณาโหลดหน้าใหม่');
        }
        const updated = await tx.place.update({
          where: { id: data.id },
          data: {
            nameTh: data.nameTh,
            nameEn: data.nameEn || null,
            descriptionTh: data.descriptionTh,
            addressTh: data.addressTh,
            provinceId: province.id,
            categoryId: category.id,
            latitude: data.latitude,
            longitude: data.longitude,
            phone: data.phone || null,
            website: data.website || null,
            status: data.status,
            isVisible: data.isVisible,
            version: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: 'UPDATE',
            entityType: 'Place',
            entityId: updated.id,
            oldValue: {
              version: previous.version,
              nameTh: previous.nameTh,
              status: previous.status,
              isVisible: previous.isVisible,
            },
            newValue: {
              version: updated.version,
              nameTh: updated.nameTh,
              status: updated.status,
              isVisible: updated.isVisible,
            },
            reason: 'แก้ไขโดยผู้ดูแล',
          },
        });
        return updated;
      }

      const baseSlug =
        (data.nameEn || data.nameTh)
          .toLocaleLowerCase('en-US')
          .normalize('NFKD')
          .replace(/[^a-z0-9]+/gu, '-')
          .replace(/^-|-$/gu, '') || 'admin-place';
      const created = await tx.place.create({
        data: {
          slug: `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`,
          nameTh: data.nameTh,
          nameEn: data.nameEn || null,
          descriptionTh: data.descriptionTh,
          addressTh: data.addressTh,
          latitude: data.latitude,
          longitude: data.longitude,
          phone: data.phone || null,
          website: data.website || null,
          source: 'ADMIN',
          status: data.status,
          confidenceLevel: 'HIGH',
          trustScore: 90,
          trustFactors: { adminManaged: true },
          lastVerifiedAt: new Date(),
          isVisible: data.isVisible,
          provinceId: province.id,
          categoryId: category.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'CREATE',
          entityType: 'Place',
          entityId: created.id,
          newValue: { version: created.version, nameTh: created.nameTh, status: created.status },
          reason: 'สร้างโดยผู้ดูแล',
        },
      });
      return created;
    });
    revalidatePath('/admin/places');
    revalidatePath('/explore');
    return { ok: true, data: { id: saved.id, version: saved.version } };
  } catch (error) {
    return {
      ok: false,
      formError: error instanceof Error ? error.message : 'ไม่สามารถบันทึกสถานที่ได้',
    };
  }
}

export async function setReviewHidden(
  reviewId: string,
  hidden: boolean,
  reason: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsedReason = hidden ? plainText(5, 500).safeParse(reason) : null;
  if (hidden && !parsedReason?.success) {
    return { ok: false, formError: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' };
  }
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) return { ok: false, formError: 'ไม่พบรีวิว' };
  await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { isHidden: hidden, hiddenReason: hidden ? parsedReason?.data : null },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: hidden ? 'HIDE_REVIEW' : 'RESTORE_REVIEW',
        entityType: 'Review',
        entityId: reviewId,
        oldValue: { isHidden: review.isHidden, hiddenReason: review.hiddenReason },
        newValue: { isHidden: hidden, hiddenReason: hidden ? parsedReason?.data : null },
        reason: hidden ? parsedReason?.data : 'กู้คืนโดยผู้ดูแล',
      },
    }),
  ]);
  revalidatePath('/admin/reviews');
  revalidatePath('/reviews');
  return { ok: true, data: undefined };
}

export async function updateCategory(input: {
  id: string;
  nameTh: string;
  nameEn: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const nameTh = plainText(2, 100).safeParse(input.nameTh);
  const nameEn = plainText(2, 100).safeParse(input.nameEn);
  if (!nameTh.success || !nameEn.success) return { ok: false, formError: 'ชื่อหมวดหมู่ไม่ถูกต้อง' };
  const previous = await prisma.category.findUnique({ where: { id: input.id } });
  if (!previous) return { ok: false, formError: 'ไม่พบหมวดหมู่' };
  const updated = await prisma.category.update({
    where: { id: input.id },
    data: { nameTh: nameTh.data, nameEn: nameEn.data, isActive: input.isActive },
  });
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: input.id,
      oldValue: { nameTh: previous.nameTh, nameEn: previous.nameEn, isActive: previous.isActive },
      newValue: { nameTh: updated.nameTh, nameEn: updated.nameEn, isActive: updated.isActive },
    },
  });
  revalidatePath('/admin/categories');
  return { ok: true, data: undefined };
}

export async function updateProvince(input: {
  id: string;
  nameTh: string;
  nameEn: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const nameTh = plainText(2, 100).safeParse(input.nameTh);
  const nameEn = plainText(2, 100).safeParse(input.nameEn);
  if (!nameTh.success || !nameEn.success) return { ok: false, formError: 'ชื่อจังหวัดไม่ถูกต้อง' };
  const previous = await prisma.province.findUnique({ where: { id: input.id } });
  if (!previous) return { ok: false, formError: 'ไม่พบจังหวัด' };
  const updated = await prisma.province.update({
    where: { id: input.id },
    data: { nameTh: nameTh.data, nameEn: nameEn.data },
  });
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'Province',
      entityId: input.id,
      oldValue: { nameTh: previous.nameTh, nameEn: previous.nameEn },
      newValue: { nameTh: updated.nameTh, nameEn: updated.nameEn },
    },
  });
  revalidatePath('/admin/provinces');
  return { ok: true, data: undefined };
}

export async function setUserSuspended(
  userId: string,
  suspended: boolean,
  reason: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) return { ok: false, formError: 'ไม่สามารถระงับบัญชีตนเอง' };
  if (suspended && reason.trim().length < 5)
    return { ok: false, formError: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, formError: 'ไม่พบผู้ใช้' };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: suspended ? new Date() : null },
    }),
    ...(suspended ? [prisma.session.deleteMany({ where: { userId } })] : []),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: suspended ? 'SUSPEND' : 'UNSUSPEND',
        entityType: 'User',
        entityId: userId,
        reason: reason.trim() || 'กู้คืนสิทธิ์โดยผู้ดูแล',
      },
    }),
  ]);
  revalidatePath('/admin/users');
  return { ok: true, data: undefined };
}

export async function resolveReport(
  reportId: string,
  resolution: string,
  dismissed = false,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = plainText(5, 1000).safeParse(resolution);
  if (!parsed.success) return { ok: false, formError: 'กรุณาระบุผลการพิจารณาอย่างน้อย 5 ตัวอักษร' };
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, formError: 'ไม่พบรายงาน' };
  await prisma.$transaction([
    prisma.report.update({
      where: { id: reportId },
      data: { status: dismissed ? 'DISMISSED' : 'RESOLVED', resolution: parsed.data },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: dismissed ? 'DISMISS_REPORT' : 'RESOLVE_REPORT',
        entityType: 'Report',
        entityId: reportId,
        reason: parsed.data,
      },
    }),
  ]);
  revalidatePath('/admin/reports');
  return { ok: true, data: undefined };
}

export async function moderateSubmission({
  id,
  decision,
  reason,
  revision,
}: {
  id: string;
  decision: Decision;
  reason: string;
  revision: number;
}): Promise<ActionResult<{ status: SubmissionStatus; placeId?: string }>> {
  const session = await requireAdmin();
  const trimmedReason = reason.trim();
  if (decision !== 'APPROVE' && trimmedReason.length < 5) {
    return { ok: false, formError: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findFirst({
        where: { id, status: 'PENDING', deletedAt: null },
        include: { images: true },
      });
      if (!submission) throw new Error('ไม่พบรายการรอตรวจ');
      if (submission.revision !== revision)
        throw new Error('มี revision ใหม่กว่า กรุณาโหลดหน้าอีกครั้ง');

      if (decision !== 'APPROVE') {
        const status = decision === 'REJECT' ? ('REJECTED' as const) : ('NEEDS_REVISION' as const);
        await tx.submission.update({
          where: { id },
          data: {
            status,
            adminMessage: trimmedReason,
            decidedAt: new Date(),
            reviewedRevision: revision,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: decision,
            entityType: 'Submission',
            entityId: id,
            reason: trimmedReason,
          },
        });
        await tx.notification.create({
          data: {
            userId: submission.submitterId,
            type: status === 'REJECTED' ? 'SUBMISSION_REJECTED' : 'SUBMISSION_NEEDS_REVISION',
            titleTh:
              status === 'REJECTED' ? 'ข้อมูลไม่ได้รับการอนุมัติ' : 'ผู้ดูแลขอข้อมูลเพิ่มเติม',
            titleEn: status === 'REJECTED' ? 'Submission rejected' : 'Changes requested',
            bodyTh: trimmedReason,
            bodyEn: trimmedReason,
            link: `/contributions/${id}`,
          },
        });
        return { status };
      }

      const proposed = submission.proposedData as unknown as ProposedPlace;
      let placeId: string;
      let oldValue: Prisma.InputJsonValue | undefined;
      if (submission.kind === 'UPDATE') {
        if (!submission.targetPlaceId) throw new Error('รายการแก้ไขไม่มีสถานที่เป้าหมาย');
        const snapshot = submission.originalSnapshot as { version?: number } | null;
        const target = await tx.place.findFirst({
          where: { id: submission.targetPlaceId, deletedAt: null },
        });
        if (!target || target.version !== snapshot?.version)
          throw new Error('ข้อมูลสถานที่ถูกแก้ไขแล้ว กรุณาตรวจ diff ใหม่');
        oldValue = submission.originalSnapshot as Prisma.InputJsonValue;
        const updated = await tx.place.update({
          where: { id: target.id, version: target.version },
          data: {
            nameTh: proposed.nameTh,
            nameEn: proposed.nameEn,
            descriptionTh: proposed.descriptionTh,
            descriptionEn: proposed.descriptionEn,
            addressTh: proposed.addressTh,
            latitude: proposed.latitude,
            longitude: proposed.longitude,
            phone: proposed.phone,
            website: proposed.website,
            provinceId: submission.provinceId,
            districtId: submission.districtId,
            categoryId: submission.categoryId,
            source: 'USER_SUBMISSION',
            status: 'VERIFIED',
            isVisible: true,
            lastVerifiedAt: new Date(),
            trustScore: 80,
            confidenceLevel: 'HIGH',
            version: { increment: 1 },
          },
        });
        placeId = updated.id;
      } else {
        const created = await tx.place.create({
          data: {
            slug: `${proposed.nameTh.toLocaleLowerCase('th-TH').replace(/[^\p{L}\p{N}]+/gu, '-')}-${id.slice(-7)}`,
            nameTh: proposed.nameTh,
            nameEn: proposed.nameEn,
            descriptionTh: proposed.descriptionTh,
            descriptionEn: proposed.descriptionEn,
            addressTh: proposed.addressTh,
            latitude: proposed.latitude,
            longitude: proposed.longitude,
            phone: proposed.phone,
            website: proposed.website,
            provinceId: submission.provinceId,
            districtId: submission.districtId,
            categoryId: submission.categoryId,
            source: 'USER_SUBMISSION',
            status: 'VERIFIED',
            isVisible: true,
            lastVerifiedAt: new Date(),
            trustScore: 80,
            confidenceLevel: 'HIGH',
            petRule: {
              create: {
                petTypes: proposed.petTypes,
                petSizes: ['SMALL', 'MEDIUM', 'LARGE'],
                indoorAllowed: proposed.indoorAllowed,
                outdoorAllowed: proposed.outdoorAllowed,
                leashRequired: proposed.leashRequired,
              },
            },
            businessHours: proposed.open24Hours
              ? {
                  create: [
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY',
                  ].map((weekday) => ({ weekday: weekday as 'MONDAY', is24Hours: true })),
                }
              : undefined,
          },
        });
        placeId = created.id;
      }

      if (submission.images.length) {
        await tx.placeImage.createMany({
          data: submission.images.map((image) => ({
            placeId,
            objectKey: image.objectKey,
            altTh: image.altTh,
            altEn: image.altEn,
            sortOrder: image.sortOrder,
            isCover: image.isCover,
            uploadedById: submission.submitterId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.submission.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decidedAt: new Date(),
          reviewedRevision: revision,
          adminMessage: trimmedReason || null,
          targetPlaceId: placeId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'APPROVE',
          entityType: 'Submission',
          entityId: id,
          oldValue,
          newValue: submission.proposedData as Prisma.InputJsonValue,
          reason: trimmedReason || 'ผ่านการตรวจสอบข้อมูลและหลักฐาน',
        },
      });
      await tx.notification.create({
        data: {
          userId: submission.submitterId,
          type: 'SUBMISSION_APPROVED',
          titleTh: 'ข้อมูลได้รับการอนุมัติแล้ว',
          titleEn: 'Submission approved',
          bodyTh: `สถานที่ ${proposed.nameTh} แสดงบนแผนที่แล้ว`,
          bodyEn: `${proposed.nameEn || proposed.nameTh} is now visible on the map.`,
          link: `/places/${placeId}`,
        },
      });
      return { status: 'APPROVED' as const, placeId };
    });
    revalidatePath('/admin/submissions');
    revalidatePath('/contributions');
    revalidatePath('/explore');
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      formError: error instanceof Error ? error.message : 'ไม่สามารถบันทึกผลการพิจารณาได้',
    };
  }
}
