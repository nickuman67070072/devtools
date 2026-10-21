import { expect, it } from 'vitest';
import { buildOsmData } from '@/features/map/osm-data';
import type { MapHouse } from '@/features/map/map-types';

it('keeps one WebGL feature per place, including coincident coordinates, without count labels', () => {
  const houses: MapHouse[] = Array.from({ length: 3201 }, (_, index) => ({
    id: String(index),
    latitude: 13.75,
    longitude: index < 3 ? 100.5 : 100.5 + index / 100000,
    provinceCode: '10',
    color: '#186454',
  }));
  const { data, groups } = buildOsmData(houses);
  expect(data.features).toHaveLength(3201);
  expect([...groups.values()].flat().map((house) => house.id)).toEqual(
    houses.map((house) => house.id),
  );
  expect(data.features[0]!.properties).not.toHaveProperty('count');
  expect(data.features[0]!.geometry).toEqual(data.features[1]!.geometry);
  expect(data.features[0]!.id).not.toBe(data.features[1]!.id);
  expect(data.features[0]!.properties).not.toHaveProperty('descriptionTh');
});
it('marks private construction geometry distinctly and leaves an empty collection valid', () => {
  const { data } = buildOsmData([
    {
      id: 'private',
      provinceCode: '10',
      latitude: 13.75,
      longitude: 100.5,
      color: '#186454',
      construction: {
        id: 'private',
        provinceCode: '10',
        latitude: 13.75,
        longitude: 100.5,
        nameTh: 'Draft',
        nameEn: 'Draft',
        status: 'DRAFT',
        href: '/my-submissions/private',
      },
    },
  ]);
  expect(data.features[0]!.properties).toMatchObject({ construction: true, color: '#e8a32a' });
  expect(buildOsmData([]).data.features).toEqual([]);
});
