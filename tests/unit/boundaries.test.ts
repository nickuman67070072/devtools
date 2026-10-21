import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDistricts, getProvinces } from '@/lib/boundaries';
describe('official boundary snapshot', () => {
  it('contains exactly 77 unique provinces and 926 districts without orphans', async () => {
    const [provinces, districts] = await Promise.all([getProvinces(), getDistricts()]);
    expect(provinces).toHaveLength(77);
    expect(new Set(provinces.map((item) => item.code)).size).toBe(77);
    expect(districts).toHaveLength(926);
    const codes = new Set(provinces.map((item) => item.code));
    expect(districts.every((item) => codes.has(item.provinceCode))).toBe(true);
  });
  it('matches the source manifest SHA-256 values', async () => {
    const directory = path.resolve('public/data/boundaries');
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')) as {
      files: Record<string, { file: string; sha256: string }>;
    };
    for (const item of Object.values(manifest.files)) {
      const content = await readFile(path.join(directory, item.file), 'utf8');
      expect(createHash('sha256').update(content).digest('hex')).toBe(item.sha256);
    }
  });
});
