import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { prisma } from '../src/lib/prisma';
import { reviewImportedPlace } from '../src/features/admin/import-service';
import { importedPayloadSchema, type BoundaryFeature } from '../src/lib/place-import';

// This command is intentionally pinned to the exact user-authorized dataset.
const sha256 = '675303981513a75758b9530ce60c58b2bfcf80bb15199b9551cf062ac0a976db';
const apply = process.argv.includes('--apply');
const boundaries = JSON.parse(
  await readFile('public/data/boundaries/provinces.geojson', 'utf8'),
) as { features: BoundaryFeature[] };
function coastalProvince(latitude: number, longitude: number) {
  const sx = 111320 * Math.cos((latitude * Math.PI) / 180);
  const distances = boundaries.features
    .map((feature) => {
      let meters = Infinity;
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates as number[][][]]
          : (feature.geometry.coordinates as number[][][][]);
      for (const polygon of polygons)
        for (const ring of polygon)
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1]!,
              b = ring[i]!;
            const ax = (a[0]! - longitude) * sx,
              ay = (a[1]! - latitude) * 111320;
            const dx = (b[0]! - a[0]!) * sx,
              dy = (b[1]! - a[1]!) * 111320;
            const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
            meters = Math.min(meters, Math.hypot(ax + t * dx, ay + t * dy));
          }
      return { code: feature.properties.code, meters };
    })
    .sort((a, b) => a.meters - b.meters);
  const nearest = distances[0],
    second = distances[1];
  // Only handle unambiguous tiny gaps along simplified coastlines; never relocate coordinates.
  if (!nearest || !second || nearest.meters > 100 || second.meters < 5000)
    throw new Error('Ambiguous province; manual review required');
  return nearest;
}
try {
  const batch = await prisma.placeImportBatch.findUniqueOrThrow({ where: { sha256 } });
  if (batch.total !== 3199 || batch.dataset !== 'thailand-pet-places')
    throw new Error('Unexpected batch');
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null, suspendedAt: null },
    select: { id: true },
  });
  if (admins.length !== 1)
    throw new Error('Expected one active Admin; select an actor explicitly before proceeding');
  const rows = await prisma.importedPlace.findMany({
    where: { batchId: batch.id },
    orderBy: { externalId: 'asc' },
  });
  if (rows.length !== 3199) throw new Error('Unexpected record count');
  const reason =
    'ผู้ดูแลสั่งอนุมัติข้อมูลนำเข้าครบ 3,199 รายการ เผยแพร่ตามต้นทางโดยคงข้อมูลที่ขาดและคำเตือน ไม่ถือเป็นการตรวจยืนยันสถานที่จริง';
  const report: {
    id: string;
    status: string;
    provinceEstimate?: { code: string; meters: number };
    error?: string;
  }[] = [];
  await mkdir('infra/runtime/place-imports', { recursive: true });
  for (const row of rows) {
    if (row.status !== 'PENDING') {
      report.push({ id: row.externalId, status: row.status });
      continue;
    }
    try {
      const payload = importedPayloadSchema.parse(row.payload);
      const provinceEstimate = payload.provinceCode
        ? undefined
        : coastalProvince(payload.latitude, payload.longitude);
      if (provinceEstimate) {
        payload.provinceCode = provinceEstimate.code;
        payload.qualityFlags.push('province_estimated_from_local_ddpm_coastline');
      }
      if (apply)
        await reviewImportedPlace(admins[0]!.id, {
          id: row.id,
          version: row.version,
          decision: 'APPROVE',
          publishAsReported: true,
          reason,
          payload,
        });
      report.push({ id: row.externalId, status: apply ? 'APPROVED' : 'READY', provinceEstimate });
    } catch (error) {
      report.push({
        id: row.externalId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (report.length % 100 === 0)
      console.log(
        JSON.stringify({
          processed: report.length,
          failed: report.filter((item) => item.status === 'FAILED').length,
        }),
      );
  }
  await writeFile(
    `infra/runtime/place-imports/bulk-approval-${apply ? 'apply' : 'dry-run'}.json`,
    JSON.stringify({ sha256, at: new Date().toISOString(), apply, report }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      apply,
      total: report.length,
      outcomes: report.reduce<Record<string, number>>((counts, item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
        return counts;
      }, {}),
    }),
  );
  if (report.some((item) => item.status === 'FAILED')) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
