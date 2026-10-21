import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { requireImportAdmin } from '@/features/admin/import-auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/features/admin/admin-shell';
import { ImportBulkReview } from '@/features/admin/import-bulk-review';

export const dynamic = 'force-dynamic';
export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireImportAdmin();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? '1', 10) || 1));
  const status =
    params.status === 'APPROVED' || params.status === 'REJECTED' ? params.status : 'PENDING';
  const where: Prisma.ImportedPlaceWhereInput = {
    status,
    ...(params.q ? { name: { contains: params.q.slice(0, 160), mode: 'insensitive' } } : {}),
    ...(params.province ? { provinceCode: params.province } : {}),
  };
  const [rows, total, provinces] = await Promise.all([
    prisma.importedPlace.findMany({
      where,
      take: 50,
      skip: (page - 1) * 50,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.importedPlace.count({ where }),
    prisma.province.findMany({ select: { code: true, nameTh: true }, orderBy: { nameTh: 'asc' } }),
  ]);
  const href = (value: number) =>
    '/admin/imports?' +
    new URLSearchParams({
      status,
      q: params.q ?? '',
      province: params.province ?? '',
      page: String(value),
    });
  return (
    <AdminShell
      title="ตรวจข้อมูลนำเข้า"
      description="รายการนำเข้ายังไม่ปรากฏบนแผนที่จนกว่าจะตรวจและอนุมัติ ไม่แก้ไขสถานที่เดิมอัตโนมัติ"
    >
      <form className="mb-5 flex flex-wrap items-end gap-3">
        <label>
          ค้นหา
          <input name="q" defaultValue={params.q} className="block rounded-lg border p-2" />
        </label>
        <label>
          สถานะ
          <select name="status" defaultValue={status} className="block rounded-lg border p-2">
            <option value="PENDING">รอตรวจ</option>
            <option value="APPROVED">อนุมัติแล้ว</option>
            <option value="REJECTED">ไม่อนุมัติ</option>
          </select>
        </label>
        <label>
          จังหวัด
          <select
            name="province"
            defaultValue={params.province ?? ''}
            className="block rounded-lg border p-2"
          >
            <option value="">ทั้งหมด</option>
            {provinces.map((item) => (
              <option key={item.code} value={item.code}>
                {item.nameTh}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg border px-4 py-2">กรอง</button>
      </form>
      <p className="mb-3">
        {total.toLocaleString('th-TH')} รายการ • หน้า {page}
      </p>
      {status === 'PENDING' && rows.length > 0 && (
        <ImportBulkReview
          rows={rows.map(({ id, version, name, warnings }) => ({ id, version, name, warnings }))}
        />
      )}
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border bg-white p-4">
            <Link className="font-bold underline" href={'/admin/imports/' + row.id}>
              {row.name}
            </Link>
            <p className="mt-1 text-sm">
              {provinces.find((item) => item.code === row.provinceCode)?.nameTh ??
                'ต้องตรวจจังหวัด'}{' '}
              • {row.categoryCodes.join(', ')}
            </p>
            {row.warnings.length > 0 && (
              <p className="mt-2 text-sm text-[#91421e]">ข้อควรตรวจ: {row.warnings.join(', ')}</p>
            )}
          </article>
        ))}
        {!rows.length && <p>ไม่มีรายการในตัวกรองนี้</p>}
      </div>
      <nav aria-label="หน้ารายการนำเข้า" className="mt-5 flex gap-5">
        {page > 1 && <Link href={href(page - 1)}>ก่อนหน้า</Link>}
        {page * 50 < total && <Link href={href(page + 1)}>ถัดไป</Link>}
      </nav>
    </AdminShell>
  );
}
