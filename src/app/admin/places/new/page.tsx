import { AdminPlaceForm } from '@/features/admin/admin-place-form';
import { AdminShell } from '@/features/admin/admin-shell';
import { prisma } from '@/lib/prisma';

export default async function NewAdminPlacePage() {
  const [provinces, categories] = await Promise.all([
    prisma.province.findMany({ orderBy: { nameTh: 'asc' } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return (
    <AdminShell title="เพิ่มสถานที่" description="ข้อมูลที่สร้างโดยผู้ดูแลจะระบุ source เป็น ADMIN">
      <AdminPlaceForm
        provinces={provinces.map((item) => ({ code: item.code, label: item.nameTh }))}
        categories={categories.map((item) => ({ code: item.code, label: item.nameTh }))}
      />
    </AdminShell>
  );
}
