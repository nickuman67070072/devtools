import {
  Activity,
  FileClock,
  MapPinned,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';

import { AdminShell } from '@/features/admin/admin-shell';
import { prisma } from '@/lib/prisma';

export default async function AdminDashboard() {
  const [pending, places, users, reports, audits] = await Promise.all([
    prisma.submission.count({ where: { status: 'PENDING', deletedAt: null } }),
    prisma.place.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { actor: true } }),
  ]);
  const cards = [
    [pending, 'รอตรวจ', FileClock, '#d98a2f'],
    [places, 'สถานที่', MapPinned, '#2d5a43'],
    [users, 'ผู้ใช้', UsersRound, '#3185bd'],
    [reports, 'รายงานเปิด', TriangleAlert, '#c23934'],
  ] as const;
  return (
    <AdminShell
      title="ภาพรวมระบบ"
      description="สถานะข้อมูล การตรวจสอบ และกิจกรรมสำคัญแบบ local staging"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([value, label, Icon, color]) => (
          <article key={label} className="surface p-5">
            <span
              className="grid size-10 place-items-center rounded-2xl text-white"
              style={{ backgroundColor: color }}
            >
              <Icon className="size-5" />
            </span>
            <p className="mt-4 text-3xl font-black">{value}</p>
            <p className="text-sm font-bold text-[#5e6561]">{label}</p>
          </article>
        ))}
      </div>
      <section className="mt-8 surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2 className="mt-1 text-xl font-black">กิจกรรมล่าสุด</h2>
          </div>
          <Activity className="size-6 text-[#2d5a43]" />
        </div>
        {audits.length === 0 ? (
          <p className="mt-6 rounded-xl bg-[#f2f6f3] p-5 text-sm text-[#5e6561]">
            ยังไม่มีกิจกรรมจากผู้ดูแล
          </p>
        ) : (
          <div className="mt-5 divide-y divide-[#e7e5df]">
            {audits.map((audit) => (
              <div key={audit.id} className="flex min-w-0 items-start gap-3 py-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2d5a43]" />
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere]">
                    <strong>{audit.actor.name}</strong> · {audit.action} {audit.entityType}
                  </p>
                  <p className="mt-1 [overflow-wrap:anywhere] text-xs text-[#74858b]">
                    {audit.createdAt.toLocaleString('th-TH')} · {audit.entityId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
