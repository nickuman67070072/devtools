import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  applyRetirement,
  assertRetirementSafe,
  inspectRetirement,
  manifestHash,
} from '../src/lib/category-retirement';
import { retiredCategoriesIn } from '../src/lib/retired-categories';

// Run on the Windows host. The explicitly named Docker host is PawMap's recovery
// host, NOT the unrelated devtools container on port 3000.
const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl ||
  new URL(databaseUrl).pathname !== '/pawmap' ||
  new URL(databaseUrl).port !== '55433'
)
  throw new Error('Use the PawMap recovery database on localhost:55433/pawmap');
const db = new PrismaClient();
const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
const directory = path.resolve('infra/backups', 'category-retirement-' + stamp);
const docker = (...args: string[]) =>
  execFileSync('docker', ['exec', 'pawmap-devtools-recovery', 'docker', ...args], {
    maxBuffer: 128 * 1024 * 1024,
  });
try {
  const manifest = await inspectRetirement(db);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'dry-run.json'), JSON.stringify(manifest, null, 2));
  console.log(
    JSON.stringify({
      directory,
      manifestSha256: manifestHash(manifest),
      places: manifest.places.length,
      categories: manifest.categories.length,
      imports: manifest.imports.length,
    }),
  );
  assertRetirementSafe(manifest);
  if (process.argv.includes('--apply')) {
    const admin = await db.user.findFirstOrThrow({
      where: { role: 'ADMIN', deletedAt: null, suspendedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const restoreDb = 'pawmap_retirement_restore_' + stamp;
    const innerBackup = '/tmp/pawmap-retirement-' + stamp + '.dump';
    docker(
      'exec',
      'pawmap-local-postgres-1',
      'pg_dump',
      '-U',
      'pawmap',
      '-d',
      'pawmap',
      '-Fc',
      '-f',
      innerBackup,
    );
    const backup = docker('exec', 'pawmap-local-postgres-1', 'cat', innerBackup);
    const sha256 = createHash('sha256').update(backup).digest('hex');
    await writeFile(path.join(directory, 'pawmap.dump'), backup);
    await writeFile(path.join(directory, 'pawmap.dump.sha256'), sha256 + '\n');
    docker('exec', 'pawmap-local-postgres-1', 'createdb', '-U', 'pawmap', restoreDb);
    docker(
      'exec',
      'pawmap-local-postgres-1',
      'pg_restore',
      '-U',
      'pawmap',
      '-d',
      restoreDb,
      '--exit-on-error',
      innerBackup,
    );
    const restoreUrl = new URL(databaseUrl);
    restoreUrl.pathname = '/' + restoreDb;
    const restored = new PrismaClient({ datasources: { db: { url: restoreUrl.href } } });
    try {
      const restoredManifest = await inspectRetirement(restored);
      if (manifestHash(restoredManifest) !== manifestHash(manifest))
        throw new Error('Restore manifest mismatch: real DB untouched');
      // Exercise the real deletion transaction on the restored copy first.
      const rehearsal = await applyRetirement(restored, restoredManifest, admin.id, sha256);
      await writeFile(
        path.join(directory, 'restore-verification.json'),
        JSON.stringify(
          {
            restoreDb,
            sha256,
            manifestSha256: manifestHash(manifest),
            rehearsal,
            verifiedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } finally {
      await restored.$disconnect();
    }
    const result = await applyRetirement(db, manifest, admin.id, sha256);
    await writeFile(
      path.join(directory, 'deletion-result.json'),
      JSON.stringify({ ...result, sha256, completedAt: new Date().toISOString() }, null, 2),
    );
    // Generated snapshot only; original Downloads inputs and batch history stay intact.
    const snapshotPath = path.resolve('infra/runtime/place-imports/normalized.json');
    try {
      const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as {
        report: Record<string, unknown>;
        records: { id: string; categoryCodes: string[] }[];
      };
      await writeFile(
        path.join(directory, 'normalized-before.json'),
        JSON.stringify(snapshot, null, 2),
      );
      const removed = snapshot.records.filter(
        (item) => retiredCategoriesIn(item.categoryCodes).length,
      );
      snapshot.records = snapshot.records.filter(
        (item) => !retiredCategoriesIn(item.categoryCodes).length,
      );
      snapshot.report = {
        ...snapshot.report,
        total: snapshot.records.length,
        categories: new Set(snapshot.records.flatMap((item) => item.categoryCodes)).size,
        excluded: Number(snapshot.report.excluded ?? 0) + removed.length,
        retiredExcluded: removed.map((item) => ({
          id: item.id,
          reason: 'retired_category_entire_place',
        })),
      };
      await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    console.log(JSON.stringify({ result, backup: directory, restoreDb }));
  }
} finally {
  await db.$disconnect();
}
