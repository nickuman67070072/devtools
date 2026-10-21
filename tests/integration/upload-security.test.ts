import { fileTypeFromBuffer } from 'file-type';
import { describe, expect, it } from 'vitest';
import { hasTrustedOrigin } from '@/lib/origin';
const onePixelPng = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0,
  0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240, 31, 0, 5, 0, 1,
  255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);
describe('upload security primitives', () => {
  it('recognizes image content independent of extension', async () => {
    expect((await fileTypeFromBuffer(onePixelPng))?.mime).toBe('image/png');
    expect(
      await fileTypeFromBuffer(new TextEncoder().encode('<svg onload=alert(1)>')),
    ).toBeUndefined();
  });
  it('rejects cross-origin writes', () => {
    const trustedOrigin = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000').origin;
    expect(
      hasTrustedOrigin(
        new Request(`${trustedOrigin}/api/uploads`, { headers: { origin: trustedOrigin } }),
      ),
    ).toBe(true);
    expect(
      hasTrustedOrigin(
        new Request('http://localhost:3000/api/uploads', {
          headers: { origin: 'https://attacker.invalid' },
        }),
      ),
    ).toBe(false);
  });
});
