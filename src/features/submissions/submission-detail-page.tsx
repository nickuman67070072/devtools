import { notFound } from 'next/navigation';

import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { SubmissionForm, type SubmissionFormInitial } from '@/features/submissions/submission-form';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

type ProposedData = Pick<
  SubmissionFormInitial,
  | 'nameTh'
  | 'nameEn'
  | 'descriptionTh'
  | 'descriptionEn'
  | 'addressTh'
  | 'latitude'
  | 'longitude'
  | 'phone'
  | 'website'
  | 'petTypes'
  | 'indoorAllowed'
  | 'outdoorAllowed'
  | 'leashRequired'
  | 'open24Hours'
>;

export async function SubmissionDetailPage({ id, locale }: { id: string; locale: Locale }) {
  const session = await requireUser(locale);
  const submission = await prisma.submission.findFirst({
    where: { id, submitterId: session.user.id, deletedAt: null },
    include: { province: true, district: true, category: true, images: true },
  });
  if (!submission) notFound();

  const proposed = submission.proposedData as unknown as ProposedData;
  const editable = ['DRAFT', 'PENDING', 'NEEDS_REVISION'].includes(submission.status);
  const initial: SubmissionFormInitial = {
    id: submission.id,
    kind: submission.kind,
    targetPlaceId: submission.targetPlaceId ?? undefined,
    nameTh: proposed.nameTh,
    nameEn: proposed.nameEn ?? undefined,
    descriptionTh: proposed.descriptionTh,
    descriptionEn: proposed.descriptionEn ?? undefined,
    addressTh: proposed.addressTh,
    provinceCode: submission.province.code,
    districtCode: submission.district?.code,
    categoryCode: submission.category.code,
    latitude: proposed.latitude,
    longitude: proposed.longitude,
    phone: proposed.phone ?? undefined,
    website: proposed.website ?? undefined,
    petTypes: proposed.petTypes,
    indoorAllowed: proposed.indoorAllowed,
    outdoorAllowed: proposed.outdoorAllowed,
    leashRequired: proposed.leashRequired,
    open24Hours: proposed.open24Hours,
    imageKeys: submission.images.map((image) => image.objectKey),
  };
  const isThai = locale === 'th';

  return (
    <PageShell locale={locale}>
      <main className="container-shell py-12">
        <div className="mx-auto mb-7 flex max-w-4xl flex-wrap items-start justify-between gap-4">
          <div>
            <a
              href={withLocale(locale, '/my-submissions')}
              className="text-sm font-bold text-[#2d5a43] hover:underline"
            >
              ← {isThai ? 'รายการที่ส่งของฉัน' : 'My submissions'}
            </a>
            <h1 className="mt-3 text-3xl font-black">
              {isThai ? proposed.nameTh : proposed.nameEn || proposed.nameTh}
            </h1>
            <p className="mt-1 text-sm text-[#5e6561]">
              {isThai
                ? 'แก้ไขแล้วส่ง revision ล่าสุดให้ผู้ดูแลตรวจสอบ'
                : 'Edit and submit the latest revision for review.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge>{submission.status}</Badge>
            <Badge tone="neutral">r{submission.revision}</Badge>
          </div>
        </div>
        {submission.adminMessage && (
          <p className="mx-auto mb-6 max-w-4xl rounded-2xl border border-[#eed59d] bg-[#fff8e7] p-4 text-sm font-semibold">
            {isThai ? 'ข้อความจากผู้ดูแล: ' : 'Administrator message: '}
            {submission.adminMessage}
          </p>
        )}
        {editable ? (
          <SubmissionForm locale={locale} initial={initial} />
        ) : (
          <section className="surface mx-auto max-w-4xl p-7">
            <h2 className="text-xl font-black">
              {isThai ? 'รายการนี้สิ้นสุดการพิจารณาแล้ว' : 'This submission is final'}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5e6561]">
              {proposed.descriptionTh}
            </p>
          </section>
        )}
      </main>
    </PageShell>
  );
}
