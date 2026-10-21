import { describe, expect, it } from 'vitest';

import { googleMapsDirectionsUrl } from '@/lib/maps-url';

describe('Google Maps URL', () => {
  it('creates a keyless directions link for an exact coordinate', () => {
    const url = new URL(googleMapsDirectionsUrl(13.7563, 100.5018));
    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('destination')).toBe('13.7563,100.5018');
    expect(url.searchParams.has('key')).toBe(false);
  });
});
