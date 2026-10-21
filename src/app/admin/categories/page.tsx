import { AdminShell } from '@/features/admin/admin-shell';
import { ReferenceEditor } from '@/features/admin/reference-editor';
import { prisma } from '@/lib/prisma';

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  return (
    <AdminShell
      title="จัดการหมวดหมู่"
      description="ชื่อสองภาษาและสถานะการใช้งาน ใช้ร่วมกันทั้ง filter และแบบฟอร์ม"
    >
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[760px]">
          <thead className="bg-[#e7efe9] text-left text-sm">
            <tr>
              <th className="p-3">รหัส</th>
              <th>ชื่อไทย</th>
              <th>English</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <ReferenceEditor key={category.id} type="category" item={category} />
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
