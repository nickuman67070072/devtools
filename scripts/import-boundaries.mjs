import { createHash } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL =
  'https://gis-portal.disaster.go.th/arcgis/rest/services/MapDX/DPM_TH_Boundary/MapServer';
const OUTPUT_DIRECTORY = path.resolve('public/data/boundaries');
const ALLOWED_HOST = 'gis-portal.disaster.go.th';
const contactEmail = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
if (!contactEmail) throw new Error('NOMINATIM_CONTACT_EMAIL is required for network imports');

const sources = {
  provinces: {
    layer: 1,
    expectedCount: 77,
    fields: ['PROV_CODE', 'PROV_NAM_T', 'PROV_NAM_E', 'Centroid_x', 'Centroid_y'],
  },
  districts: {
    layer: 2,
    expectedCount: 926,
    fields: [
      'PROV_CODE',
      'AMP_CODE',
      'PROV_NAM_T',
      'PROV_NAM_E',
      'AMP_NAM_T',
      'AMP_NAM_E',
      'Centroid_x',
      'Centroid_y',
    ],
  },
};

function slugify(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildUrl(layer, fields) {
  const url = new URL(`${BASE_URL}/${layer}/query`);
  if (url.hostname !== ALLOWED_HOST) {
    throw new Error(`Unapproved data host: ${url.hostname}`);
  }
  url.search = new URLSearchParams({
    where: '1=1',
    outFields: fields.join(','),
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '5',
    maxAllowableOffset: '0.0005',
    f: 'geojson',
  }).toString();
  return url;
}

function normalizeFeature(kind, feature) {
  if (!feature || feature.type !== 'Feature' || !feature.geometry) {
    throw new Error(`${kind}: invalid GeoJSON feature`);
  }
  if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    throw new Error(`${kind}: unsupported geometry ${feature.geometry.type}`);
  }
  const source = feature.properties ?? {};
  const provinceCode = String(source.PROV_CODE ?? '').padStart(2, '0');
  const nameTh = String(kind === 'provinces' ? source.PROV_NAM_T : (source.AMP_NAM_T ?? '')).trim();
  const nameEn = String(kind === 'provinces' ? source.PROV_NAM_E : (source.AMP_NAM_E ?? '')).trim();
  const code =
    kind === 'provinces'
      ? provinceCode
      : String(source.AMP_CODE ?? '')
          .trim()
          .padStart(4, '0');
  if (!code || !provinceCode || !nameTh || !nameEn) {
    throw new Error(`${kind}: missing code or bilingual name`);
  }
  const centroidLng = Number(source.Centroid_x);
  const centroidLat = Number(source.Centroid_y);
  return {
    type: 'Feature',
    id: code,
    properties: {
      code,
      provinceCode,
      nameTh,
      nameEn,
      slug: slugify(nameEn),
      centroidLng: Number.isFinite(centroidLng) ? centroidLng : null,
      centroidLat: Number.isFinite(centroidLat) ? centroidLat : null,
    },
    geometry: feature.geometry,
  };
}

async function fetchCollection(kind, config) {
  const url = buildUrl(config.layer, config.fields);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/geo+json, application/json',
      'User-Agent': `PawMap-Thailand-Boundary-Importer/1.0 (${contactEmail})`,
    },
  });
  if (!response.ok) {
    throw new Error(`${kind}: source returned ${response.status}`);
  }
  const source = await response.json();
  if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
    throw new Error(`${kind}: source is not a FeatureCollection`);
  }
  if (source.features.length !== config.expectedCount) {
    throw new Error(
      `${kind}: expected ${config.expectedCount} records, received ${source.features.length}`,
    );
  }
  const features = source.features.map((feature) => normalizeFeature(kind, feature));
  const ids = new Set(features.map((feature) => feature.properties.code));
  if (ids.size !== config.expectedCount) {
    throw new Error(`${kind}: codes are not unique`);
  }
  return {
    url: url.toString(),
    collection: { type: 'FeatureCollection', features },
  };
}

async function main() {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const imported = {};
  for (const [kind, config] of Object.entries(sources)) {
    imported[kind] = await fetchCollection(kind, config);
  }
  const provinceCodes = new Set(
    imported.provinces.collection.features.map((feature) => feature.properties.code),
  );
  const orphanDistrict = imported.districts.collection.features.find(
    (feature) => !provinceCodes.has(feature.properties.provinceCode),
  );
  if (orphanDistrict) {
    throw new Error(`District ${orphanDistrict.properties.code} has no matching province`);
  }

  const fetchedAt = new Date().toISOString();
  const manifest = { fetchedAt, sourceAgency: 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)', files: {} };
  for (const [kind, value] of Object.entries(imported)) {
    const json = `${JSON.stringify(value.collection)}\n`;
    const temporaryPath = path.join(OUTPUT_DIRECTORY, `${kind}.geojson.next`);
    const finalPath = path.join(OUTPUT_DIRECTORY, `${kind}.geojson`);
    await writeFile(temporaryPath, json, 'utf8');
    await rename(temporaryPath, finalPath);
    manifest.files[kind] = {
      sourceUrl: value.url,
      recordCount: value.collection.features.length,
      sha256: sha256(json),
      file: `${kind}.geojson`,
    };
  }
  const manifestPath = path.join(OUTPUT_DIRECTORY, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `Imported ${manifest.files.provinces.recordCount} provinces and ${manifest.files.districts.recordCount} districts.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
