import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('prisma/migrations');
const unsafe = [];
const approvedContractions = new Map([
  [
    '20261016120000_remove_place_source_url',
    /ALTER\s+TABLE\s+"places"\s+DROP\s+COLUMN\s+"sourceUrl"/iu,
  ],
]);
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(root, entry.name, 'migration.sql');
  const sql = await readFile(file, 'utf8');
  const approved = approvedContractions.get(entry.name);
  const guardedSql = approved ? sql.replace(approved, '') : sql;
  for (const pattern of [/DROP\s+TABLE/giu, /DROP\s+COLUMN/giu, /ALTER\s+COLUMN[^;]+TYPE/giu]) {
    if (pattern.test(guardedSql)) unsafe.push(entry.name);
  }
}
if (unsafe.length) {
  process.stderr.write(
    `Potentially backward-incompatible migrations: ${[...new Set(unsafe)].join(', ')}\n`,
  );
  process.exitCode = 1;
} else process.stdout.write('Migrations pass the backward-compatibility guard.\n');
