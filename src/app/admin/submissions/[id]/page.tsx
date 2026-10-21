import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { AdminShell } from '@/features/admin/admin-shell';
import { ModerationCard } from '@/features/admin/moderation-card';
import { requireAdmin } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const submission = await prisma.submission.findFirst({
    where: { id, deletedAt: null },
    include: { submitter: true, province: true, category: true, images: true },
  });
  if (!submission) notFound();
  const proposed = submission.proposedData as Record<string, unknown>;
  const original = submission.originalSnapshot as Record<string, unknown> | null;

  return (
    <AdminShell
      title={String(proposed.nameTh ?? 'Submission')}
      description="รายละเอียด revision และผลการพิจารณารายการเดียว"
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/submissions"
          className="text-sm font-bold text-[#2d5a43] hover:underline"
        >
          ← กลับคิวตรวจข้อมูล
        </Link>
        <Badge>{submission.status}</Badge>
        <Badge tone="neutral">revision {submission.revision}</Badge>
      </div>
      {submission.status === 'PENDING' ? (
        <ModerationCard
          submission={{
            id: submission.id,
            revision: submission.revision,
            kind: submission.kind,
            name: String(proposed.nameTh ?? 'ไม่มีชื่อ'),
            submitter: submission.submitter.name,
            province: submission.province.nameTh,
            category: submission.category.nameTh,
            submittedAt: submission.submittedAt?.toLocaleString('th-TH') ?? '—',
            proposed,
            original,
            imageKeys: submission.images.map((image) => image.objectKey),
          }}
        />
      ) : (
        <section className="surface p-6">
          <h2 className="text-xl font-black">รายการนี้ได้รับการตัดสินแล้ว</h2>
          <p className="mt-2 text-sm text-[#5e6561]">{submission.adminMessage || 'ไม่มีข้อความ'}</p>
          <pre className="mt-5 overflow-auto rounded-2xl bg-[#181c1a] p-5 text-xs text-white">
            {JSON.stringify(proposed, null, 2)}
          </pre>
        </section>
      )}
    </AdminShell>
  );
}
