import { expect, it } from 'vitest';
import {
  assertRetirementSafe,
  manifestHash,
  type RetirementManifest,
} from '@/lib/category-retirement';

function manifest(): RetirementManifest {
  // Only fields consumed by the safety guard; production manifests include full
  // rows and are hashed again under a write lock before any delete statement.
  return {
    totalPlaces: 3201,
    totalCategories: 29,
    categorySubmissions: 0,
    categories: Array.from({ length: 13 }, (_, i) => ({ id: 'category-' + i })),
    places: Array.from({ length: 110 }, (_, i) => ({
      id: 'place-' + i,
      _count: {
        images: 0,
        reviews: 0,
        favorites: 0,
        reports: 0,
        verifications: 0,
        meetups: 0,
        submissions: 0,
      },
    })),
    imports: Array.from({ length: 110 }, (_, i) => ({ id: 'import-' + i, placeId: 'place-' + i })),
  } as unknown as RetirementManifest;
}
it('accepts only the exact approved counts with no linked user data', () => {
  expect(() => assertRetirementSafe(manifest())).not.toThrow();
  const changed = manifest();
  changed.totalPlaces++;
  expect(() => assertRetirementSafe(changed)).toThrow('counts changed');
  const additional = manifest();
  additional.places.pop();
  expect(() => assertRetirementSafe(additional)).toThrow('counts changed');
});
it.each([
  'images',
  'reviews',
  'favorites',
  'reports',
  'verifications',
  'meetups',
  'submissions',
] as const)('stops for a newly linked %s rather than cascading', (relation) => {
  const changed = manifest();
  changed.places[0]!._count[relation] = 1;
  expect(() => assertRetirementSafe(changed)).toThrow('linked user data');
});
it('stops for category submissions and imports outside the approved places', () => {
  const changed = manifest();
  changed.categorySubmissions = 1;
  expect(() => assertRetirementSafe(changed)).toThrow('linked user data');
  changed.categorySubmissions = 0;
  changed.imports[0]!.placeId = 'another-place';
  expect(() => assertRetirementSafe(changed)).toThrow('outside approved');
});
it('fingerprints IDs and content, not only counts', () => {
  const original = manifest();
  const changed = structuredClone(original);
  changed.places[0]!.nameTh = 'changed since backup';
  expect(manifestHash(original)).not.toBe(manifestHash(changed));
  expect(manifestHash(original)).toBe(manifestHash(structuredClone(original)));
});
