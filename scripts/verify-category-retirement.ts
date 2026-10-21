import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { retiredCategoryCodes, retiredCategoriesIn } from '../src/lib/retired-categories';
import type { RetirementManifest } from '../src/lib/category-retirement';

const directory = process.argv[2];
if (!directory) throw new Error('Pass the completed backup directory');
const manifest = JSON.parse(
  await readFile(path.join(directory, 'dry-run.json'), 'utf8'),
) as RetirementManifest;
const db = new PrismaClient();
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002';
const removed = new Set(manifest.places.map((item) => item.id));
async function json(url: string) {
  const response = await fetch(base + url);
  assert.equal(response.status, 200, url);
  return response.json();
}
try {
  assert.equal(await db.place.count(), 3091);
  assert.equal(await db.category.count(), 16);
  assert.equal(await db.place.count({ where: { id: { in: [...removed] } } }), 0);
  assert.equal(await db.category.count({ where: { code: { in: [...retiredCategoryCodes] } } }), 0);
  assert.equal(
    await db.importedPlace.count({
      where: { id: { in: manifest.imports.map((item) => item.id) } },
    }),
    0,
  );
  assert.equal(
    await db.placeImportBatch.count({
      where: { id: { in: [...new Set(manifest.imports.map((item) => item.batchId))] } },
    }),
    new Set(manifest.imports.map((item) => item.batchId)).size,
  );
  for (const detail of ['', 'compact']) {
    let cursor: number | null = 0;
    const ids = new Set<string>();
    while (cursor !== null) {
      const page = await json(`/api/places/map?detail=${detail}&cursor=${cursor}`);
      for (const feature of page.features) {
        assert(!removed.has(feature.id));
        assert(!retiredCategoriesIn(feature.properties.categoryCodes).length);
        ids.add(feature.id);
      }
      cursor = page.nextCursor;
    }
    assert.equal(ids.size, 3091);
  }
  let searchCursor: number | null = 0;
  const searchIds = new Set<string>();
  while (searchCursor !== null) {
    const page = await json(`/api/places/search?limit=50&cursor=${searchCursor}`);
    for (const item of page.items) {
      assert(!removed.has(item.id));
      searchIds.add(item.id);
    }
    searchCursor = page.nextCursor;
  }
  assert.equal(searchIds.size, 3091);
  let checked = 0;
  for (const place of manifest.places) {
    const responses = await Promise.all([
      fetch(base + '/api/places/' + place.id),
      fetch(base + '/places/' + encodeURIComponent(place.slug)),
      json('/api/meetups/places?q=' + encodeURIComponent(place.nameTh.slice(0, 100))),
    ]);
    assert.equal(responses[0].status, 404, place.id);
    assert.equal(responses[1].status, 404, place.slug);
    assert(responses[2].items.every((item: { id: string }) => !removed.has(item.id)));
    checked++;
  }
  const result = {
    places: 3091,
    categories: 16,
    removedDetails404: checked,
    compactAnd3dMaps: 'passed',
    search: 'passed',
    meetupPicker: 'passed',
    importBatchesPreserved: true,
    base,
    checkedAt: new Date().toISOString(),
  };
  await writeFile(path.join(directory, 'api-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await db.$disconnect();
}
