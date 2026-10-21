import type { MapPoint, PlaceSummary } from '@/lib/domain';

export interface ConstructionHouse {
  href: string;
  id: string;
  nameTh: string;
  nameEn: string;
  provinceCode: string;
  longitude: number;
  latitude: number;
  status: 'DRAFT' | 'PENDING';
}
export interface MapHouse {
  id: string;
  provinceCode: string;
  longitude: number;
  latitude: number;
  color: string;
  place?: PlaceSummary;
  point?: MapPoint;
  construction?: ConstructionHouse;
}
export function groupHouses(houses: MapHouse[]) {
  const groups = new Map<string, MapHouse[]>();
  for (const house of houses) {
    const key = `${house.provinceCode}:${house.longitude.toFixed(5)}:${house.latitude.toFixed(5)}`;
    const group = groups.get(key) ?? [];
    group.push(house);
    groups.set(key, group);
  }
  return [...groups.values()];
}
