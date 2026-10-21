import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('public/data/boundaries');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const expected = { provinces: 77, districts: 926 };
const provinceCodes = new Set();

for (const [kind, expectedCount] of Object.entries(expected)) {
  const metadata = manifest.files[kind];
  if (!metadata || new URL(metadata.sourceUrl).hostname !== 'gis-portal.disaster.go.th') {
    throw new Error(`${kind}: unapproved or missing source URL`);
  }
  const raw = await readFile(path.join(directory, metadata.file), 'utf8');
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== metadata.sha256) throw new Error(`${kind}: checksum mismatch`);
  const collection = JSON.parse(raw);
  if (collection.type !== 'FeatureCollection' || collection.features.length !== expectedCount) {
    throw new Error(`${kind}: expected ${expectedCount} features`);
  }
  const codes = collection.features.map((feature) => feature.properties.code);
  if (new Set(codes).size !== expectedCount) throw new Error(`${kind}: duplicate codes`);
  if (kind === 'provinces') codes.forEach((code) => provinceCodes.add(code));
  if (kind === 'districts') {
    const orphan = collection.features.find(
      (feature) => !provinceCodes.has(feature.properties.provinceCode),
    );
    if (orphan) throw new Error(`district ${orphan.properties.code}: orphan province`);
  }
}

process.stdout.write('Boundary snapshots and checksums are valid.\n');
