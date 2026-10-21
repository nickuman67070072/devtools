import { AdminShell } from '@/features/admin/admin-shell';
import { PlaceAdminAction } from '@/features/admin/place-admin-row';
import { prisma } from '@/lib/prisma';

export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  const filters = await searchParams;
  const places = await prisma.place.findMany({
    where: {
      ...(filters.q ? { nameTh: { contains: filters.q, mode: 'insensitive' } } : {}),
      ...(filters.deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null }),
    },
    include: { province: true, category: true },
    take: 100,
    orderBy: { updatedAt: 'desc' },
  });
  return (
    <AdminShell
      title="จัดการสถานที่"
      description="ค้นหา ตรวจสถานะ soft-delete และกู้คืนโดยมี AuditLog"
    >
      <div className="mb-5 flex justify-end">
        <Link
          href="/admin/places/new"
          className="inline-flex min-h-10 items-center rounded-full bg-[#2d5a43] px-5 text-sm font-bold text-white"
        >
          เพิ่มสถานที่
        </Link>
      </div>
      <form className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="ค้นหาชื่อสถานที่"
          className="min-h-11 flex-1 rounded-xl border border-[#d5d7d2] bg-white px-4"
        />
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold">
          <input
            name="deleted"
            value="true"
            type="checkbox"
            defaultChecked={filters.deleted === 'true'}
          />
          ถังข้อมูล
        </label>
        <button className="rounded-full bg-[#2d5a43] px-5 text-sm font-bold text-white">
          ค้นหา
        </button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#e7efe9]">
            <tr>
              <th className="p-4">สถานที่</th>
              <th>จังหวัด</th>
              <th>หมวดหมู่</th>
              <th>สถานะ</th>
              <th>version</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {places.map((place) => (
              <tr key={place.id} className="border-t border-[#e7e5df]">
                <td className="p-4 font-bold">
                  <Link href={`/admin/places/${place.id}`} className="hover:underline">
                    {place.nameTh}
                  </Link>
                </td>
                <td>{place.province.nameTh}</td>
                <td>{place.category.nameTh}</td>
                <td>{place.deletedAt ? 'DELETED' : place.status}</td>
                <td>{place.version}</td>
                <td className="p-3 text-right">
                  <PlaceAdminAction id={place.id} deleted={Boolean(place.deletedAt)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
import Link from 'next/link';
