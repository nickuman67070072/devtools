import { FilePenLine, Plus, Send, ShieldCheck } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { DeleteSubmissionButton } from '@/features/submissions/delete-submission-button';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export async function SubmissionsPage({ locale }: { locale: Locale }) {
  const session = await requireUser(locale);
  const submissions = await prisma.submission.findMany({
    where: { submitterId: session.user.id, deletedAt: null },
    include: { province: true, category: true },
    orderBy: { updatedAt: 'desc' },
  });
  const isThai = locale === 'th';
  return (
    <PageShell locale={locale}>
      <main className="container-shell py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">{isThai ? 'การมีส่วนร่วมของฉัน' : 'My contributions'}</p>
            <h1 className="mt-2 text-4xl font-black">
              {isThai ? 'รายการที่ส่ง' : 'My submissions'}
            </h1>
            <p className="mt-2 text-[#5e6561]">
              {isThai
                ? 'ติดตามฉบับร่าง การตรวจสอบ และข้อความจากผู้ดูแล'
                : 'Track drafts, moderation, and administrator feedback.'}
            </p>
          </div>
          <a
            href={withLocale(locale, '/submit')}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--forest)] px-5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" />
            {isThai ? 'เพิ่มสถานที่' : 'Add place'}
          </a>
        </div>
        {submissions.length === 0 ? (
          <section className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-white p-12 text-center">
            <FilePenLine className="mx-auto size-10 text-[#6f8d82]" />
            <h2 className="mt-4 text-xl font-black">
              {isThai ? 'ยังไม่มีรายการ' : 'No submissions yet'}
            </h2>
            <p className="mt-2 text-sm text-[#5e6561]">
              {isThai
                ? 'บันทึกฉบับร่างหรือช่วยเพิ่มสถานที่แรกได้เลย'
                : 'Save a draft or contribute your first place.'}
            </p>
          </section>
        ) : (
          <div className="mt-8 grid gap-4">
            {submissions.map((submission) => {
              const proposed = submission.proposedData as { nameTh?: string; nameEn?: string };
              const tone =
                submission.status === 'APPROVED'
                  ? 'emerald'
                  : submission.status === 'REJECTED'
                    ? 'red'
                    : submission.status === 'NEEDS_REVISION'
                      ? 'coral'
                      : 'blue';
              return (
                <article
                  key={submission.id}
                  className="surface flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center"
                >
                  <div className="flex gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--forest-soft)] text-[var(--forest)]">
                      {submission.status === 'APPROVED' ? (
                        <ShieldCheck className="size-5" />
                      ) : (
                        <Send className="size-5" />
                      )}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-extrabold">
                          <a
                            href={withLocale(locale, `/my-submissions/${submission.id}`)}
                            className="hover:text-[#2d5a43] hover:underline"
                          >
                            {isThai ? proposed.nameTh : proposed.nameEn || proposed.nameTh}
                          </a>
                        </h2>
                        <Badge tone={tone}>{submission.status}</Badge>
                        <Badge tone="neutral">r{submission.revision}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[#5e6561]">
                        {isThai ? submission.province.nameTh : submission.province.nameEn} ·{' '}
                        {isThai ? submission.category.nameTh : submission.category.nameEn}
                      </p>
                      {submission.adminMessage && (
                        <p className="mt-2 rounded-lg bg-[#fff7e5] px-3 py-2 text-xs font-semibold">
                          {submission.adminMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {['DRAFT', 'PENDING', 'NEEDS_REVISION'].includes(submission.status) && (
                      <DeleteSubmissionButton id={submission.id} locale={locale} />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </PageShell>
  );
}
