import { afterEach, describe, expect, it, vi } from 'vitest';

import { hasTrustedOrigin } from '@/lib/origin';

afterEach(() => vi.unstubAllEnvs());

describe('local origin check', () => {
  it('accepts both loopback hostnames without accepting a foreign origin', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
    vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');

    const request = (origin: string) =>
      new Request('http://localhost:3000/api/meetups/search', {
        headers: { origin },
      });
    expect(hasTrustedOrigin(request('http://localhost:3000'))).toBe(true);
    expect(hasTrustedOrigin(request('http://127.0.0.1:3000'))).toBe(true);
    expect(hasTrustedOrigin(request('https://example.invalid'))).toBe(false);
  });
});
