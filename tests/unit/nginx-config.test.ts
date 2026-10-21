import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('Nginx application proxy', () => {
  it('preserves the request port for Next.js Server Actions', async () => {
    const config = await readFile('infra/nginx/app.conf', 'utf8');

    expect(config).toContain('proxy_set_header Host $http_host;');
    expect(config).toContain('proxy_set_header X-Forwarded-Host $http_host;');
    expect(config).not.toContain('proxy_set_header Host $host;');
  });
});
