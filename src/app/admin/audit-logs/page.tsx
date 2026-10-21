import { AdminShell } from '@/features/admin/admin-shell';
import { prisma } from '@/lib/prisma';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; action?: string }>;
}) {
  const filters = await searchParams;
  const audits = await prisma.auditLog.findMany({
    where: {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.action ? { action: filters.action } : {}),
    },
    include: { actor: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <AdminShell
      title="ประวัติการดูแลระบบ"
      description="ตรวจสอบผู้ดำเนินการ การเปลี่ยนแปลง เวลา และเหตุผลย้อนหลัง"
    >
      <form className="mb-6 flex flex-wrap gap-3 rounded-2xl bg-white p-4">
        <input
          name="entityType"
          defaultValue={filters.entityType}
          placeholder="Entity เช่น Place"
          className="min-h-10 rounded-xl border border-[#d5d7d2] px-3 text-sm"
        />
        <input
          name="action"
          defaultValue={filters.action}
          placeholder="Action เช่น APPROVE"
          className="min-h-10 rounded-xl border border-[#d5d7d2] px-3 text-sm"
        />
        <button className="min-h-10 rounded-full bg-[#2d5a43] px-5 text-sm font-bold text-white">
          กรอง
        </button>
      </form>
      <div className="overflow-x-auto rounded-[24px] border border-[#e7e5df] bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#f0f5f2] text-xs uppercase text-[#5e6561]">
            <tr>
              <th className="p-4">เวลา</th>
              <th className="p-4">ผู้ดูแล</th>
              <th className="p-4">Action</th>
              <th className="p-4">Entity</th>
              <th className="p-4">เหตุผล</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit) => (
              <tr key={audit.id} className="border-t border-[#e7e5df] align-top">
                <td className="p-4 whitespace-nowrap">{audit.createdAt.toLocaleString('th-TH')}</td>
                <td className="p-4 font-bold">{audit.actor.name}</td>
                <td className="p-4">{audit.action}</td>
                <td className="p-4">
                  {audit.entityType} · {audit.entityId}
                </td>
                <td className="max-w-sm p-4 whitespace-pre-wrap">{audit.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {audits.length === 0 && <p className="p-10 text-center">ไม่พบ AuditLog ตามตัวกรอง</p>}
      </div>
    </AdminShell>
  );
}
