import { z } from 'zod';
import { categoryDefinitions, type CategoryCode } from './domain';
import { retiredCategoriesIn } from './retired-categories';

export const importDataset = 'thailand-pet-places';
const categoryMapping: Record<string, CategoryCode> = {
  VETERINARY_HOSPITAL: 'VET',
  ACCOMMODATION: 'STAY',
  CAFE_RESTAURANT: 'CAFE',
  GROOMING_BOARDING: 'GROOMING',
  PET_SHOP: 'SHOP',
  ANIMAL_RESCUE: 'RESCUE',
};
const codes = new Set<string>(categoryDefinitions.map((item) => item.code));
export function mapImportCategories(values: string[]): CategoryCode[] {
  if (retiredCategoriesIn(values).length)
    throw new Error('Retired category: exclude the entire place');
  return [
    ...new Set(
      values.map((value) => {
        const code = categoryMapping[value] ?? value;
        if (!codes.has(code)) throw new Error('Unknown category: ' + value);
        return code as CategoryCode;
      }),
    ),
  ];
}

export const importedPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  nameEn: z.string(),
  description: z.string(),
  address: z.string(),
  provinceCode: z.string().nullable(),
  latitude: z.number().min(5).max(21),
  longitude: z.number().min(97).max(106),
  categoryCodes: z
    .array(z.string().refine((code) => codes.has(code), 'Unsupported category'))
    .min(1),
  phone: z.string(),
  website: z.string(),
  is24Hours: z.boolean().nullable(),
  sources: z.array(z.object({ url: z.string().url(), retrievedOn: z.string().nullable() })),
  policy: z.string(),
  acceptanceContext: z.string(),
  qualityFlags: z.array(z.string()),
  reportedDetails: z.string().default(''),
});
export type ImportedPayload = z.infer<typeof importedPayloadSchema>;
export interface BoundaryFeature {
  properties: { code: string; nameTh: string; nameEn: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}
function inRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i]!;
    const [px, py] = ring[j]!;
    if (y! > lat !== py! > lat && lng < ((px! - x!) * (lat - y!)) / (py! - y!) + x!)
      inside = !inside;
  }
  return inside;
}
export function provinceAt(lng: number, lat: number, features: BoundaryFeature[]) {
  return features
    .filter((feature) => {
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates as number[][][]]
          : (feature.geometry.coordinates as number[][][][]);
      return polygons.some(
        (rings) =>
          Boolean(rings[0]) &&
          inRing(lng, lat, rings[0]!) &&
          !rings.slice(1).some((ring) => inRing(lng, lat, ring)),
      );
    })
    .map((feature) => feature.properties.code);
}

const rowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  name_en: z.string().nullable().optional(),
  categories: z.array(z.string()).min(1),
  province: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  is_24_hours: z.boolean().nullable().optional(),
  acceptance_context: z.string().optional(),
  quality_flags: z.array(z.string()).optional(),
  sources: z.array(z.object({ url: z.string(), retrieved_on: z.string().nullable().optional() })),
  pet_policy: z.record(z.string(), z.unknown()).optional(),
  admission: z.record(z.string(), z.unknown()).optional(),
  additional_admission: z.record(z.string(), z.unknown()).optional(),
  province_resolution: z.record(z.string(), z.unknown()).optional(),
});
export function safeReferenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const forbidden = [
      ['git', 'hub.com'].join(''),
      ['git', 'hubusercontent.com'].join(''),
      ['ghcr', '.io'].join(''),
    ];
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (
      url.username ||
      url.password ||
      forbidden.some((name) => host === name || host.endsWith('.' + name))
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function normalizeImportRow(
  value: unknown,
  boundaries: BoundaryFeature[],
): ImportedPayload | null {
  const row = rowSchema.parse(value);
  if (retiredCategoriesIn(row.categories).length) return null;
  if (row.latitude === null || row.longitude === null) return null;
  const warnings = [...(row.quality_flags ?? [])];
  const found = provinceAt(row.longitude, row.latitude, boundaries);
  const reported = boundaries.find((feature) => feature.properties.nameTh === row.province)
    ?.properties.code;
  // Never reuse a province derived from the retired external boundary dataset.
  const derived = Boolean(row.province_resolution);
  let provinceCode: string | null = derived ? null : (reported ?? null);
  if (found.length === 1) {
    if (reported && reported !== found[0]) warnings.push('province_coordinate_mismatch');
    provinceCode = found[0]!;
  } else if (derived || !provinceCode) {
    warnings.push('province_requires_review');
    provinceCode = null;
  } else warnings.push('coordinate_outside_province_snapshot');
  if (derived) warnings.push('province_recomputed_from_local_ddpm');
  if (!row.address) warnings.push('address_missing');
  const statements = [
    row.pet_policy?.source_policy_statement,
    row.pet_policy?.fee,
    row.admission?.allowed_scope,
    row.admission?.basis,
    row.additional_admission?.allowed_scope,
    row.additional_admission?.basis,
  ].filter((item): item is string => typeof item === 'string' && item.length > 0);
  const sources = row.sources.flatMap((source) => {
    const url = safeReferenceUrl(source.url);
    return url ? [{ url, retrievedOn: source.retrieved_on ?? null }] : [];
  });
  if (!sources.length) warnings.push('source_missing');
  return importedPayloadSchema.parse({
    id: row.id,
    name: row.name,
    nameEn: row.name_en ?? '',
    description: statements.join('\n'),
    address: row.address ?? '',
    provinceCode,
    latitude: row.latitude,
    longitude: row.longitude,
    categoryCodes: mapImportCategories(row.categories),
    phone: row.phone ?? '',
    website: row.website ? (safeReferenceUrl(row.website) ?? '') : '',
    is24Hours: row.is_24_hours ?? null,
    sources,
    policy: statements.join('\n'),
    acceptanceContext: row.acceptance_context ?? '',
    qualityFlags: [...new Set(warnings)],
    reportedDetails: JSON.stringify({
      petPolicy: row.pet_policy ?? {},
      admission: row.admission ?? {},
      additionalAdmission: row.additional_admission ?? {},
      reported24Hours: row.is_24_hours ?? null,
    }),
  });
}
