import { describe, expect, it } from 'vitest';

import { parseExploreUrl } from '@/lib/explore-url';

describe('explore URL state', () => {
  it('defaults to the local 3D view', () => {
    expect(parseExploreUrl(new URLSearchParams()).view).toBe('3d');
  });

  it('restores the OSM view and visible filters while discarding retired filters', () => {
    const state = parseExploreUrl(
      new URLSearchParams('view=osm&q=cafe&verifiedOnly=true&place=sample-place'),
      'bangkok',
    );
    expect(state).toMatchObject({
      view: 'osm',
      selectedPlaceSlug: 'sample-place',
      filters: { province: 'bangkok', query: 'cafe' },
    });
    expect(state.filters).not.toHaveProperty('verifiedOnly');
    expect(
      parseExploreUrl(
        new URLSearchParams('openNow=true&twentyFourHours=true&verifiedOnly=true&minimumRating=4'),
      ).filters,
    ).toEqual({
      province: undefined,
      query: undefined,
      district: undefined,
      categories: undefined,
    });
  });

  it('rejects unknown map views', () => {
    expect(parseExploreUrl(new URLSearchParams('view=google')).view).toBe('3d');
  });
});
