import { AdminShell } from '@/features/admin/admin-shell';
import { ModerationCard } from '@/features/admin/moderation-card';
import { prisma } from '@/lib/prisma';

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string; kind?: string }>;
}) {
  const filters = await searchParams;
  const submissions = await prisma.submission.findMany({
    where: {
      status: 'PENDING',
      deletedAt: null,
      ...(filters.province ? { province: { code: filters.province } } : {}),
      ...(filters.kind === 'CREATE' || filters.kind === 'UPDATE' ? { kind: filters.kind } : {}),
    },
    include: { submitter: true, province: true, category: true, images: true },
    orderBy: { submittedAt: 'asc' },
  });
  const provinces = await prisma.province.findMany({ orderBy: { nameTh: 'asc' } });
  return (
    <AdminShell
      title="คิวตรวจข้อมูล"
      description="เฉพาะรายการ PENDING revision ล่าสุด รายการที่ลบจะไม่ปรากฏในคิว"
    >
      <form className="mb-6 flex flex-wrap gap-3 rounded-2xl bg-white p-4">
        <select
          name="province"
          defaultValue={filters.province ?? ''}
          className="min-h-10 rounded-xl border border-[#d5d7d2] px-3 text-sm"
        >
          <option value="">ทุกจังหวัด</option>
          {provinces.map((province) => (
            <option key={province.id} value={province.code}>
              {province.nameTh}
            </option>
          ))}
        </select>
        <select
          name="kind"
          defaultValue={filters.kind ?? ''}
          className="min-h-10 rounded-xl border border-[#d5d7d2] px-3 text-sm"
        >
          <option value="">CREATE และ UPDATE</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
        </select>
        <button className="min-h-10 rounded-full bg-[#2d5a43] px-5 text-sm font-bold text-white">
          กรอง
        </button>
      </form>
      {submissions.length === 0 ? (
        <p className="rounded-[26px] border border-dashed border-[#b8ccc3] bg-white/60 p-12 text-center font-bold text-[#5e6561]">
          ไม่มีรายการที่ตรงกับตัวกรอง
        </p>
      ) : (
        <div className="grid gap-5">
          {submissions.map((submission) => (
            <ModerationCard
              key={submission.id}
              submission={{
                id: submission.id,
                revision: submission.revision,
                kind: submission.kind,
                name: String(
                  (submission.proposedData as { nameTh?: string }).nameTh ?? 'ไม่มีชื่อ',
                ),
                submitter: submission.submitter.name,
                province: submission.province.nameTh,
                category: submission.category.nameTh,
                submittedAt: submission.submittedAt?.toLocaleString('th-TH') ?? '—',
                proposed: submission.proposedData as Record<string, unknown>,
                original: submission.originalSnapshot as Record<string, unknown> | null,
                imageKeys: submission.images.map((image) => image.objectKey),
              }}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
