import { notFound } from 'next/navigation';
import { requireImportAdmin } from '@/features/admin/import-auth';
import { prisma } from '@/lib/prisma';
import { importedPayloadSchema, safeReferenceUrl } from '@/lib/place-import';
import { AdminShell } from '@/features/admin/admin-shell';
import { ImportReviewForm } from '@/features/admin/import-review-form';

export const dynamic = 'force-dynamic';
export default async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireImportAdmin();
  const record = await prisma.importedPlace.findUnique({
    where: { id: (await params).id },
    include: { batch: true },
  });
  if (!record) notFound();
  const payload = importedPayloadSchema.parse(record.payload);
  const provinces = await prisma.province.findMany({
    select: { code: true, nameTh: true },
    orderBy: { nameTh: 'asc' },
  });
  return (
    <AdminShell
      title={record.name}
      description={`สถานะ ${record.status} • รุ่น ${record.version} • ${record.externalId}`}
    >
      <section className="mb-5 rounded-xl border p-4">
        <h2 className="font-bold">ต้นทางและข้อควรตรวจ</h2>
        <p className="mt-2 break-all text-sm">
          ไฟล์: {record.batch.fileName}
          <br />
          SHA-256: {record.batch.sha256}
        </p>
        <p className="mt-2 text-sm">
          {record.warnings.join(', ') || 'ไม่มีข้อเตือนอัตโนมัติ — ยังต้องตรวจข้อมูลจริง'}
        </p>
        <p className="mt-2 whitespace-pre-line">{payload.policy}</p>
        <p>{payload.acceptanceContext}</p>
        <ul className="mt-3 space-y-2">
          {payload.sources
            .filter((source) => safeReferenceUrl(source.url))
            .map((source, index) => (
              <li key={index}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="break-all underline"
                >
                  {source.url}
                </a>
                <span className="text-sm">
                  {' '}
                  • วันที่เก็บข้อมูล {source.retrievedOn ?? 'ไม่ระบุ'}
                </span>
              </li>
            ))}
        </ul>
        <p className="mt-3 text-sm">
          วันที่เก็บข้อมูลไม่ใช่วันที่ยืนยันสถานที่ กรุณาตรวจข้อมูลและนโยบายสัตว์เลี้ยงก่อนอนุมัติ
        </p>
      </section>
      <details className="mb-5 rounded-xl border p-4">
        <summary>รายละเอียดนโยบายตามข้อมูลต้นทาง (ยังไม่ถือว่ายืนยัน)</summary>
        <pre className="mt-3 whitespace-pre-wrap break-all text-sm">{payload.reportedDetails}</pre>
      </details>
      <ImportReviewForm
        id={record.id}
        version={record.version}
        initial={payload}
        provinces={provinces}
        editable={record.status === 'PENDING'}
      />
    </AdminShell>
  );
}
