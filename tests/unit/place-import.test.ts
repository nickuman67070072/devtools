import { describe, expect, it } from 'vitest';
import { categoryDefinitions } from '@/lib/domain';
import { retiredCategoryCodes } from '@/lib/retired-categories';
import { activeCategoryCode } from '@/lib/validation';
import {
  mapImportCategories,
  normalizeImportRow,
  provinceAt,
  safeReferenceUrl,
  type BoundaryFeature,
} from '@/lib/place-import';

const boundaries: BoundaryFeature[] = [
  {
    properties: { code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [100, 13],
          [101, 13],
          [101, 14],
          [100, 14],
          [100, 13],
        ],
      ],
    },
  },
];
const row = {
  id: 'test',
  name: 'สวนทดสอบ',
  categories: ['PARK', 'DOG_RUN'],
  province: null,
  address: null,
  latitude: 13.5,
  longitude: 100.5,
  sources: [{ url: 'https://source.invalid/place', retrieved_on: '2026-10-14' }],
};
describe('private pet place normalization', () => {
  it('supports only the 16 retained categories without changing their codes', () => {
    expect(categoryDefinitions).toHaveLength(16);
    expect(mapImportCategories(['ACCOMMODATION', 'STAY', 'DOG_RUN'])).toEqual(['STAY', 'DOG_RUN']);
    expect(() => mapImportCategories(['UNKNOWN'])).toThrow();
  });
  it.each([...retiredCategoryCodes, 'EMERGENCY_24H'])(
    'excludes the entire multi-category place for %s',
    (code) => {
      expect(normalizeImportRow({ ...row, categories: ['PARK', code] }, boundaries)).toBeNull();
      expect(() => mapImportCategories(['PARK', code])).toThrow();
      expect(activeCategoryCode.safeParse(code).success).toBe(false);
    },
  );
  it('excludes missing coordinates rather than inventing a marker', () => {
    expect(normalizeImportRow({ ...row, latitude: null }, boundaries)).toBeNull();
    expect(() => normalizeImportRow({ ...row, latitude: 99 }, boundaries)).toThrow();
  });
  it('resolves the province from local polygons and flags missing addresses', () => {
    const normalized = normalizeImportRow(row, boundaries)!;
    expect(normalized.provinceCode).toBe('10');
    expect(normalized.address).toBe('');
    expect(normalized.qualityFlags).toContain('address_missing');
    expect(normalized.is24Hours).toBeNull();
  });
  it('does not trust the retired boundary-derived province outside the official snapshot', () => {
    const normalized = normalizeImportRow(
      {
        ...row,
        province: 'กรุงเทพมหานคร',
        longitude: 102,
        province_resolution: { method: 'old-boundary' },
      },
      boundaries,
    )!;
    expect(normalized.provinceCode).toBeNull();
    expect(normalized).not.toHaveProperty('province_resolution');
  });
  it('preserves provenance, source policy and uncertain pet acceptance without verification claims', () => {
    const normalized = normalizeImportRow(
      {
        ...row,
        pet_policy: {
          dogs_allowed: true,
          cats_allowed: null,
          advance_contact_required: true,
          source_policy_statement: 'Confirm before visiting',
        },
      },
      boundaries,
    )!;
    expect(normalized.policy).toBe('Confirm before visiting');
    expect(normalized.reportedDetails).toContain('advance_contact_required');
    expect(normalized).not.toHaveProperty('lastVerifiedAt');
  });
  it('rejects unsafe and forbidden reference hosts, allows passive data references', () => {
    expect(safeReferenceUrl('javascript:alert(1)')).toBeNull();
    expect(safeReferenceUrl('https://user:password@source.invalid')).toBeNull();
    expect(
      safeReferenceUrl('https://' + ['raw.git', 'hubusercontent.com'].join('') + '/x'),
    ).toBeNull();
    expect(safeReferenceUrl('https://source.invalid/place')).toBe('https://source.invalid/place');
  });
  it('handles polygon holes and multipolygons', () => {
    const polygon = {
      ...boundaries[0]!,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [100, 13],
              [101, 13],
              [101, 14],
              [100, 14],
              [100, 13],
            ],
            [
              [100.4, 13.4],
              [100.6, 13.4],
              [100.6, 13.6],
              [100.4, 13.6],
              [100.4, 13.4],
            ],
          ],
        ],
      },
    };
    expect(provinceAt(100.5, 13.5, [polygon])).toEqual([]);
    expect(provinceAt(100.2, 13.2, [polygon])).toEqual(['10']);
  });
});
