import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { importedPayloadSchema, safeReferenceUrl } from '@/lib/place-import';
import { categoryDefinitions } from '@/lib/domain';
import { calculateTrustScore } from '@/lib/trust-score';

export const importDecisionSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(2000).default(''),
  payload: importedPayloadSchema.optional(),
  confirmDistinct: z.boolean().default(false),
  linkPlaceId: z.string().optional(),
  publishAsReported: z.boolean().default(false),
});
export type ImportDecision = z.input<typeof importDecisionSchema>;
const normalizedName = (name: string) =>
  name
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
function nearby(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((a.latitude - b.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((a.longitude - b.longitude) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h))) <= 500;
}

export async function reviewImportedPlace(actorId: string, input: unknown) {
  const decision = importDecisionSchema.parse(input);
  return prisma.$transaction(
    async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: actorId, role: 'ADMIN', deletedAt: null, suspendedAt: null },
      });
      if (!actor) throw new Error('ไม่มีสิทธิ์ตรวจข้อมูลนำเข้า');
      // Serialize import decisions so duplicate detection and approval remain atomic.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(42816)`;
      const record = await tx.importedPlace.findUniqueOrThrow({ where: { id: decision.id } });
      if (record.status !== 'PENDING' || record.version !== decision.version)
        throw new Error('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่');
      if (decision.decision === 'REJECT' && !decision.reason)
        throw new Error('กรุณาระบุเหตุผลที่ไม่อนุมัติ');
      const original = importedPayloadSchema.parse(record.payload);
      const payload = decision.payload ?? original;
      if (decision.publishAsReported && decision.reason.trim().length < 20)
        throw new Error('กรุณาบันทึกเหตุผลการเผยแพร่ข้อมูลตามต้นทางที่ยังไม่ยืนยัน');
      if (decision.publishAsReported)
        payload.qualityFlags = [
          ...new Set([...payload.qualityFlags, 'published_as_source_reported']),
        ];
      if (payload.id !== original.id) throw new Error('รหัสต้นทางเปลี่ยนไม่ได้');
      let placeId: string | null = null;
      if (decision.decision === 'APPROVE') {
        if (
          !payload.provinceCode ||
          (!decision.publishAsReported &&
            (payload.address.trim().length < 5 || payload.description.trim().length < 20))
        )
          throw new Error('กรุณาตรวจจังหวัด ที่อยู่ และรายละเอียดให้ครบก่อนอนุมัติ');
        if (
          [payload.name, payload.nameEn, payload.address, payload.description].some((value) =>
            /[<>]/u.test(value),
          )
        )
          throw new Error('ข้อมูลต้องเป็นข้อความธรรมดา');
        if (payload.website && !safeReferenceUrl(payload.website))
          throw new Error('เว็บไซต์ไม่ถูกต้อง');
        const sources = original.sources.filter((source) => safeReferenceUrl(source.url));
        const placeImportSnapshot = Object.fromEntries(
          Object.entries(original).filter(([key]) => key !== 'sources'),
        );
        const province = await tx.province.findUniqueOrThrow({
          where: { code: payload.provinceCode },
        });
        const uniqueCodes = [...new Set(payload.categoryCodes)];
        if (uniqueCodes.some((code) => !categoryDefinitions.some((item) => item.code === code)))
          throw new Error('หมวดหมู่ไม่ถูกต้อง');
        const categories = await tx.category.findMany({
          where: { code: { in: uniqueCodes }, isActive: true },
        });
        const primary = categories.find((item) => item.code === uniqueCodes[0]);
        if (!primary || categories.length !== uniqueCodes.length)
          throw new Error('หมวดหมู่ไม่ได้เปิดใช้งาน');
        if (decision.linkPlaceId) {
          const existing = await tx.place.findFirst({
            where: { id: decision.linkPlaceId, deletedAt: null },
          });
          if (!existing || existing.provinceId !== province.id || !nearby(payload, existing))
            throw new Error('สถานที่เชื่อมโยงต้องอยู่จังหวัดเดียวกันและห่างไม่เกิน 500 เมตร');
          placeId = existing.id; // Linking never overwrites existing contributions.
        } else {
          const candidates = await tx.place.findMany({
            where: {
              provinceId: province.id,
              deletedAt: null,
              latitude: { gte: payload.latitude - 0.005, lte: payload.latitude + 0.005 },
              longitude: { gte: payload.longitude - 0.006, lte: payload.longitude + 0.006 },
            },
            select: { id: true, nameTh: true, latitude: true, longitude: true },
          });
          const duplicates = candidates.filter(
            (item) =>
              normalizedName(item.nameTh) === normalizedName(payload.name) && nearby(payload, item),
          );
          if (duplicates.length && !decision.confirmDistinct && !decision.publishAsReported)
            throw new Error(
              'อาจซ้ำกับสถานที่: ' +
                duplicates.map((item) => `${item.nameTh} (${item.id})`).join(', ') +
                ' — เชื่อมโยงรายการเดิมหรือยืนยันว่าเป็นคนละสถานที่',
            );
          if (duplicates.length && decision.publishAsReported)
            payload.qualityFlags = [
              ...new Set([...payload.qualityFlags, 'possible_duplicate_retained']),
            ];
          const now = new Date();
          const trust = calculateTrustScore(
            {
              lastVerifiedAt: now,
              verifications: [
                {
                  kind: 'ADMIN',
                  isConfirmed: true,
                  createdAt: now,
                  hasEvidence: sources.length > 0,
                },
              ],
              confirmedReports: 0,
            },
            now,
          );
          const created = await tx.place.create({
            data: {
              slug:
                'import-' +
                createHash('sha256')
                  .update(record.dataset + ':' + record.externalId)
                  .digest('hex')
                  .slice(0, 24),
              nameTh: payload.name,
              nameEn: payload.nameEn || null,
              descriptionTh: payload.description,
              addressTh: payload.address,
              latitude: payload.latitude,
              longitude: payload.longitude,
              provinceId: province.id,
              categoryId: primary.id,
              additionalCategories: {
                connect: categories
                  .filter((item) => item.id !== primary.id)
                  .map((item) => ({ id: item.id })),
              },
              source: 'OPEN_DATA',
              externalId: record.dataset + ':' + record.externalId,
              categoryDetails: {
                import: { ...placeImportSnapshot, qualityFlags: payload.qualityFlags },
                publishedAsReported: decision.publishAsReported,
              },
              phone: payload.phone || null,
              website: payload.website || null,
              status: decision.publishAsReported ? 'STALE' : 'VERIFIED',
              isVisible: true,
              lastVerifiedAt: decision.publishAsReported ? null : now,
              trustScore: decision.publishAsReported ? 0 : trust.score,
              confidenceLevel: decision.publishAsReported ? 'LOW' : trust.level,
              trustFactors: decision.publishAsReported
                ? { sourceReported: true, fieldVerified: false }
                : trust.factors,
              verifications: decision.publishAsReported
                ? undefined
                : {
                    create: {
                      kind: 'ADMIN',
                      userId: actorId,
                      note: 'Reviewed imported record ' + record.id,
                    },
                  },
            },
          });
          placeId = created.id;
        }
      }
      const updated = await tx.importedPlace.updateMany({
        where: { id: record.id, version: decision.version, status: 'PENDING' },
        data: {
          status: decision.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          version: { increment: 1 },
          reviewedById: actorId,
          reviewedAt: new Date(),
          reason: decision.reason,
          placeId,
          name: payload.name,
          provinceCode: payload.provinceCode,
          categoryCodes: payload.categoryCodes,
          warnings: payload.qualityFlags,
          payload: { ...payload, sources: original.sources },
        },
      });
      if (updated.count !== 1) throw new Error('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่');
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'IMPORT_' + decision.decision,
          entityType: 'ImportedPlace',
          entityId: record.id,
          oldValue: original,
          newValue: { placeId, payload },
          reason: decision.reason,
        },
      });
      return { placeId };
    },
    { timeout: 20000 },
  );
}
