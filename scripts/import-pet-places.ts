import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { categoryDefinitions } from '../src/lib/domain';
import { retiredCategoriesIn } from '../src/lib/retired-categories';
import { importDataset, normalizeImportRow, type BoundaryFeature } from '../src/lib/place-import';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
if (!input) throw new Error('Usage: tsx scripts/import-pet-places.ts FILE [--apply]');
const apply = args.includes('--apply');
const bytes = await readFile(path.resolve(input));
const sha256 = createHash('sha256').update(bytes).digest('hex');
const file = z
  .object({ places: z.array(z.unknown()), pending_places: z.array(z.unknown()).default([]) })
  .parse(JSON.parse(bytes.toString('utf8')));
const baseIndex = args.indexOf('--base');
let baseSha256: string | null = null;
if (baseIndex !== -1) {
  const baseFile = args[baseIndex + 1];
  if (!baseFile) throw new Error('Missing --base FILE');
  const baseBytes = await readFile(path.resolve(baseFile));
  const base = z
    .object({
      places: z.array(z.object({ id: z.string() })),
      pending_places: z.array(z.object({ id: z.string() })).default([]),
    })
    .parse(JSON.parse(baseBytes.toString('utf8')));
  const ids = new Set(
    z
      .array(z.object({ id: z.string() }))
      .parse([...file.places, ...file.pending_places])
      .map((row) => row.id),
  );
  const missing = [...base.places, ...base.pending_places].filter((row) => !ids.has(row.id));
  if (missing.length) throw new Error('Expanded file is missing base IDs: ' + missing.length);
  baseSha256 = createHash('sha256').update(baseBytes).digest('hex');
}
const boundaries = JSON.parse(
  await readFile('public/data/boundaries/provinces.geojson', 'utf8'),
) as { features: BoundaryFeature[] };
const rows = [...file.places, ...file.pending_places];
const seen = new Set<string>();
const excludedRetired: { id: string; reason: string; categories: string[] }[] = [];
const records = rows.flatMap((row) => {
  const source = z.object({ id: z.string(), categories: z.array(z.string()) }).parse(row);
  const retired = retiredCategoriesIn(source.categories);
  if (retired.length) {
    excludedRetired.push({
      id: source.id,
      reason: 'retired_category_entire_place',
      categories: retired,
    });
    return [];
  }
  const item = normalizeImportRow(row, boundaries.features);
  if (!item) return [];
  if (seen.has(item.id)) throw new Error('Duplicate source ID: ' + item.id);
  seen.add(item.id);
  return [item];
});
const report = {
  dataset: importDataset,
  fileName: path.basename(input),
  sha256,
  baseSha256,
  total: records.length,
  excluded: rows.length - records.length,
  excludedRetired,
  categories: [...new Set(records.flatMap((item) => item.categoryCodes))].length,
  missingProvince: records.filter((item) => !item.provinceCode).length,
  missingAddress: records.filter((item) => !item.address).length,
  mode: apply ? 'apply' : 'dry-run',
};
await mkdir('infra/runtime/place-imports', { recursive: true });
await writeFile('infra/runtime/place-imports/report.json', JSON.stringify(report, null, 2) + '\n');
// Private normalized snapshot: no original excluded rows or retired boundary references.
await writeFile(
  'infra/runtime/place-imports/normalized.json',
  JSON.stringify({ report, records }, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
if (apply) {
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const [sortOrder, category] of categoryDefinitions.entries())
          await tx.category.upsert({
            where: { code: category.code },
            update: {},
            create: { ...category, sortOrder },
          });
        const batch = await tx.placeImportBatch.upsert({
          where: { sha256 },
          update: {},
          create: {
            dataset: importDataset,
            sha256,
            fileName: report.fileName,
            total: report.total,
            excluded: report.excluded,
          },
        });
        const result = await tx.importedPlace.createMany({
          data: records.map((item) => ({
            dataset: importDataset,
            externalId: item.id,
            batchId: batch.id,
            name: item.name,
            provinceCode: item.provinceCode,
            categoryCodes: item.categoryCodes,
            warnings: item.qualityFlags,
            payload: item,
          })),
          skipDuplicates: true,
        });
        console.log(
          JSON.stringify({
            batchId: batch.id,
            inserted: result.count,
            unchanged: records.length - result.count,
          }),
        );
      },
      { timeout: 120_000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
