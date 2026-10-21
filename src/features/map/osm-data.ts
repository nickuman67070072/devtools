import type { FeatureCollection, Point } from 'geojson';
import type { MapHouse } from './map-types';

export function buildOsmData(houses: MapHouse[]) {
  const groups = new Map<string, MapHouse[]>();
  const data: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
  for (const first of houses) {
    const id = first.id;
    groups.set(id, [first]);
    data.features.push({
      type: 'Feature',
      id,
      geometry: { type: 'Point', coordinates: [first.longitude, first.latitude] },
      properties: {
        groupId: id,
        color: first.construction ? '#e8a32a' : first.color,
        construction: Boolean(first.construction),
        icon: first.construction ? 'pawmap-construction' : `pawmap-marker-${first.color}`,
      },
    });
  }
  return { data, groups };
}
