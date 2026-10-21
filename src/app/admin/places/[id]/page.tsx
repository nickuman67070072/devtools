import { notFound } from 'next/navigation';

import { AdminPlaceForm } from '@/features/admin/admin-place-form';
import { AdminShell } from '@/features/admin/admin-shell';
import { requireAdmin } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';

export default async function EditAdminPlacePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [place, provinces, categories] = await Promise.all([
    prisma.place.findUnique({ where: { id }, include: { province: true, category: true } }),
    prisma.province.findMany({ orderBy: { nameTh: 'asc' } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  if (!place) notFound();
  return (
    <AdminShell
      title={place.nameTh}
      description={`แก้ไขแบบ optimistic concurrency · version ${place.version}`}
    >
      <AdminPlaceForm
        provinces={provinces.map((item) => ({ code: item.code, label: item.nameTh }))}
        categories={categories.map((item) => ({ code: item.code, label: item.nameTh }))}
        initial={{
          id: place.id,
          version: place.version,
          nameTh: place.nameTh,
          nameEn: place.nameEn ?? '',
          descriptionTh: place.descriptionTh,
          addressTh: place.addressTh,
          provinceCode: place.province.code,
          categoryCode: place.category.code,
          latitude: place.latitude,
          longitude: place.longitude,
          phone: place.phone ?? '',
          website: place.website ?? '',
          status: place.status,
          isVisible: place.isVisible,
        }}
      />
    </AdminShell>
  );
}
