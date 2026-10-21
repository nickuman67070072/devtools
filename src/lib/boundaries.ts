import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DistrictSummary, ProvinceSummary } from '@/lib/domain';

interface BoundaryProperties {
  code: string;
  provinceCode: string;
  nameTh: string;
  nameEn: string;
  slug: string;
  centroidLat: number | null;
  centroidLng: number | null;
}

interface BoundaryFeature {
  type: 'Feature';
  properties: BoundaryProperties;
}

interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
}

async function readCollection(name: 'provinces' | 'districts') {
  const filePath = path.join(process.cwd(), 'public', 'data', 'boundaries', `${name}.geojson`);
  return JSON.parse(await readFile(filePath, 'utf8')) as BoundaryCollection;
}

export async function getProvinces(): Promise<ProvinceSummary[]> {
  const collection = await readCollection('provinces');
  return collection.features
    .map(({ properties }) => ({
      code: properties.code,
      slug: properties.slug,
      nameTh: properties.nameTh,
      nameEn: properties.nameEn,
      centroidLat: properties.centroidLat ?? 13.0,
      centroidLng: properties.centroidLng ?? 101.0,
      placeCount: 3,
    }))
    .sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'));
}

export async function getDistricts(provinceCode?: string): Promise<DistrictSummary[]> {
  const collection = await readCollection('districts');
  return collection.features
    .map(({ properties }) => ({
      code: properties.code,
      provinceCode: properties.provinceCode,
      slug: properties.slug,
      nameTh: properties.nameTh,
      nameEn: properties.nameEn,
    }))
    .filter((district) => !provinceCode || district.provinceCode === provinceCode)
    .sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'));
}
