import { categoryDefinitions, type CategoryCode, type MapFilters } from '@/lib/domain';

export interface ExploreUrlState {
  filters: MapFilters;
  selectedPlaceSlug?: string;
  view: ExploreMapView;
}

export type ExploreMapView = '3d' | 'osm';

export function parseExploreUrl(
  searchParams: Pick<URLSearchParams, 'get'>,
  province?: string,
): ExploreUrlState {
  const categories = (searchParams.get('categories') ?? '')
    .split(',')
    .filter((code): code is CategoryCode =>
      categoryDefinitions.some((category) => category.code === code),
    );
  return {
    filters: {
      province,
      query: searchParams.get('q')?.trim() || undefined,
      district: searchParams.get('district')?.trim() || undefined,
      categories: categories.length ? categories : undefined,
    },
    selectedPlaceSlug: searchParams.get('place')?.trim() || undefined,
    view: searchParams.get('view') === 'osm' ? 'osm' : '3d',
  };
}

export function toUrlSearchParams(values: Record<string, string | string[] | undefined>) {
  const result = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    const item = Array.isArray(value) ? value[0] : value;
    if (item) result.set(key, item);
  });
  return result;
}
