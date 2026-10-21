import { AdminShell } from '@/features/admin/admin-shell';
import { ReferenceEditor } from '@/features/admin/reference-editor';
import { prisma } from '@/lib/prisma';

export default async function ProvincesPage() {
  const provinces = await prisma.province.findMany({ orderBy: { code: 'asc' } });
  return (
    <AdminShell
      title="จัดการจังหวัด"
      description="ข้อมูลตั้งต้นมาจาก snapshot ปภ. การแก้ชื่อทุกครั้งบันทึก AuditLog"
    >
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[720px]">
          <thead className="bg-[#e7efe9] text-left text-sm">
            <tr>
              <th className="p-3">รหัส</th>
              <th>ชื่อไทย</th>
              <th>English</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {provinces.map((province) => (
              <ReferenceEditor key={province.id} type="province" item={province} />
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
