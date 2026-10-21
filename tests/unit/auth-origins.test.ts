import { describe, expect, it } from 'vitest';

import { getTrustedOrigins } from '@/lib/auth-origins';

describe('authentication trusted origins', () => {
  it('accepts both local hostnames on the configured port', () => {
    expect(getTrustedOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
    expect(getTrustedOrigins('http://127.0.0.1:3000')).toEqual([
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]);
  });

  it('supports an explicit comma-separated allowlist without adding remote origins', () => {
    expect(
      getTrustedOrigins(
        'https://tile.openstreetmap.org',
        'https://tile.openstreetmap.org, https://gis-portal.disaster.go.th',
      ),
    ).toEqual(['https://tile.openstreetmap.org', 'https://gis-portal.disaster.go.th']);
  });
});
